import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:dio/dio.dart';
import '../utils/binary_parser.dart';

/// 심볼 해시 계산 헬퍼 (웹단의 getHashCode와 100% 동일)
int getHashCode(String str) {
  int hash = 0;
  for (int i = 0; i < str.length; i++) {
    int char = str.codeUnitAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & 0xFFFFFFFF; // 32비트 연산 적용
  }
  // 자바스크립트의 비트 연산 결과 대응 및 부호 처리
  if (hash & 0x80000000 != 0) {
    hash = -((~hash + 1) & 0xFFFFFFFF);
  }
  return hash.abs();
}

final int btcSymbolId = getHashCode("BTC-USD");
final int adaSymbolId = getHashCode("ADA-KRW");

/// 실시간 체결 로그 데이터 모델
class TradeLog {
  final String tradeId;
  final String symbol;
  final String side; // 'BUY' | 'SELL'
  final double price;
  final double qty;
  final DateTime executedAt;

  TradeLog({
    required this.tradeId,
    required this.symbol,
    required this.side,
    required this.price,
    required this.qty,
    required this.executedAt,
  });
}

/// 거래소 상태 관리 모델
class ExchangeState {
  final String apiBaseUrl;
  final String wsUrl;
  final String activeSymbol;
  final bool wsConnected;
  final double lastPrice;
  final List<TradeLog> tradesLog;
  final Map<int, int> bids; // price_cents -> qty
  final Map<int, int> asks; // price_cents -> qty
  final double midPrice;
  final double spread;
  final double volumePower;

  ExchangeState({
    // 안드로이드 에뮬레이터에서 호스트 PC의 로컬 서버에 접근하기 위한 디폴트 IP는 10.0.2.2 입니다.
    this.apiBaseUrl = 'http://10.0.2.2:8181',
    this.wsUrl = 'ws://10.0.2.2:8088/ws',
    this.activeSymbol = 'BTC-USD',
    this.wsConnected = false,
    this.lastPrice = 0.0,
    this.tradesLog = const [],
    this.bids = const {},
    this.asks = const {},
    this.midPrice = 0.0,
    this.spread = 0.0,
    this.volumePower = 100.0,
  });

  ExchangeState copyWith({
    String? apiBaseUrl,
    String? wsUrl,
    String? activeSymbol,
    bool? wsConnected,
    double? lastPrice,
    List<TradeLog>? tradesLog,
    Map<int, int>? bids,
    Map<int, int>? asks,
    double? midPrice,
    double? spread,
    double? volumePower,
  }) {
    return ExchangeState(
      apiBaseUrl: apiBaseUrl ?? this.apiBaseUrl,
      wsUrl: wsUrl ?? this.wsUrl,
      activeSymbol: activeSymbol ?? this.activeSymbol,
      wsConnected: wsConnected ?? this.wsConnected,
      lastPrice: lastPrice ?? this.lastPrice,
      tradesLog: tradesLog ?? this.tradesLog,
      bids: bids ?? this.bids,
      asks: asks ?? this.asks,
      midPrice: midPrice ?? this.midPrice,
      spread: spread ?? this.spread,
      volumePower: volumePower ?? this.volumePower,
    );
  }
}

/// 전역 거래소 상태 관리자
class ExchangeNotifier extends StateNotifier<ExchangeState> {
  ExchangeNotifier() : super(ExchangeState()) {
    initStore();
  }

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  final Dio _dio = Dio();

  // 10단 호가 배치 갱신용 메모리 맵
  final Map<int, int> _bidsMap = {};
  final Map<int, int> _asksMap = {};
  List<TradeLog> _tradesLogList = [];

  // 체결강도 계산용 임시 윈도우
  final List<Map<String, dynamic>> _tradesPowerWindow = [];

  void initStore() async {
    // 호스트 IP 연동 로직
    const String host = '10.0.2.2'; // 기본 로컬 테스트 IP
    final String base = 'http://$host:8181';
    final String wsUrl = 'ws://$host:8088/ws';

    state = state.copyWith(apiBaseUrl: base, wsUrl: wsUrl);

    // 스냅샷 호출 및 웹소켓 연결
    await fetchFullSnapshot(state.activeSymbol);
    _connectWebSocket();
  }

  /// 활성 거래 대상 심볼 변경
  Future<void> setActiveSymbol(String symbol) async {
    _bidsMap.clear();
    _asksMap.clear();
    _tradesPowerWindow.clear();
    _tradesLogList = [];

    state = state.copyWith(
      activeSymbol: symbol,
      lastPrice: 0.0,
      bids: {},
      asks: {},
      midPrice: 0.0,
      spread: 0.0,
      volumePower: 100.0,
      tradesLog: [],
    );

    await fetchFullSnapshot(symbol);
  }

  /// 전체 호가 스냅샷 API 동기화
  Future<void> fetchFullSnapshot(String symbol) async {
    final int port = symbol == 'BTC-USD' ? 9100 : 9101;
    // 에뮬레이터에서 호스트 호가 스냅샷 서버 포트로 바인딩
    final String url = 'http://10.0.2.2:$port/snapshot';

    try {
      final response = await _dio.get(url);
      if (response.statusCode == 200) {
        final data = response.data;
        _bidsMap.clear();
        _asksMap.clear();

        if (data['bids'] != null) {
          for (var item in data['bids']) {
            _bidsMap[item[0] as int] = item[1] as int;
          }
        }
        if (data['asks'] != null) {
          for (var item in data['asks']) {
            _asksMap[item[0] as int] = item[1] as int;
          }
        }

        _updateOrderBookCalculations();
      }
    } catch (e) {
      print('[스냅샷 에러] $symbol 호가 동기화 실패: $e');
    }
  }

  /// 바이너리 고성능 웹소켓 연결 수립
  void _connectWebSocket() {
    _subscription?.cancel();
    _channel?.sink.close();
    _reconnectTimer?.cancel();

    print('[웹소켓 연결 시도] ${state.wsUrl}');
    try {
      _channel = WebSocketChannel.connect(Uri.parse(state.wsUrl));
      state = state.copyWith(wsConnected: true);

      _subscription = _channel!.stream.listen(
        (data) {
          // 바이너리 메시지만 파싱 처리
          if (data is Uint8List) {
            _handleBinaryMessage(data);
          }
        },
        onError: (err) {
          print('[웹소켓 에러] $err');
          _handleDisconnect();
        },
        onDone: () {
          print('[웹소켓 끊김]');
          _handleDisconnect();
        },
      );
    } catch (e) {
      print('[웹소켓 연결 예외] $e');
      _handleDisconnect();
    }
  }

  /// 웹소켓 끊김 시 3초 후 재연결 처리
  void _handleDisconnect() {
    state = state.copyWith(wsConnected: false);
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      _connectWebSocket();
    });
  }

  /// 바이너리 데이터 수신 처리 (32바이트)
  void _handleBinaryMessage(Uint8List bytes) {
    if (bytes.length != 32) return;

    final update = OrderbookUpdate.fromBinary(bytes);
    
    // 현재 수신한 패킷의 심볼 일치 여부 판별
    final int currentTargetHash = state.activeSymbol == 'BTC-USD' ? btcSymbolId : adaSymbolId;
    if (update.symbolId != currentTargetHash) return;

    final double price = update.realPrice;
    final int cents = update.price;
    final int qty = update.qty;
    final int side = update.side;

    // 1. 호가창 잔량 실시간 적용
    final targetMap = side == 0 ? _bidsMap : _asksMap;
    final currentQty = targetMap[cents] ?? 0;
    final nextQty = currentQty + qty;

    if (nextQty <= 0) {
      targetMap.remove(cents);
    } else {
      targetMap[cents] = nextQty;
    }

    // 2. 수량이 음수인 경우 체결(Match) 발생에 해당
    if (qty < 0) {
      final double actualQty = qty.abs().toDouble();
      final newTrade = TradeLog(
        tradeId: '${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(100)}',
        symbol: state.activeSymbol,
        side: side == 0 ? 'BUY' : 'SELL',
        price: price,
        qty: actualQty,
        executedAt: DateTime.now(),
      );

      _tradesLogList.insert(0, newTrade);
      if (_tradesLogList.length > 50) {
        _tradesLogList = _tradesLogList.sublist(0, 50);
      }

      // 체결 강도 윈도우 적재 (최근 10초 이내)
      final now = DateTime.now();
      _tradesPowerWindow.add({
        'time': now,
        'side': side,
        'qty': actualQty,
      });

      _cleanTradesPowerWindow(now);
    }

    _updateOrderBookCalculations();
  }

  /// 체결 강도 윈도우 오래된 데이터 만료 처리
  void _cleanTradesPowerWindow(DateTime now) {
    _tradesPowerWindow.removeWhere((item) =>
        now.difference(item['time'] as DateTime).inSeconds > 10);
  }

  /// 호가창 정렬 및 수치 계산 배치 갱신
  void _updateOrderBookCalculations() {
    // Bids (매수 호가): 내림차순 정렬 상위 10단
    final sortedBids = _bidsMap.entries.toList()
      ..sort((a, b) => b.key.compareTo(a.key));
    final topBids = Map<int, int>.fromEntries(sortedBids.take(10));

    // Asks (매도 호가): 오름차순 정렬 상위 10단
    final sortedAsks = _asksMap.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    final topAsks = Map<int, int>.fromEntries(sortedAsks.take(10));

    double mid = 0.0;
    double diff = 0.0;

    if (topBids.isNotEmpty && topAsks.isNotEmpty) {
      final double bestBid = topBids.keys.first / 100.0;
      final double bestAsk = topAsks.keys.first / 100.0;
      mid = (bestBid + bestAsk) / 2.0;
      diff = bestAsk - bestBid;
    }

    // 체결 강도 계산 (Volume Power)
    double buySum = 0.0;
    double sellSum = 0.0;
    for (var item in _tradesPowerWindow) {
      // side == 1 이 매수 측 가중치 부여
      if (item['side'] == 1) {
        buySum += item['qty'] as double;
      } else {
        sellSum += item['qty'] as double;
      }
    }
    final double power = sellSum > 0.0 ? (buySum / sellSum) * 100.0 : 100.0;

    // 최종 상태 갱신
    state = state.copyWith(
      bids: topBids,
      asks: Map<int, int>.fromEntries(topAsks.entries.toList().reversed), // UI 렌더링 편의를 위해 매도는 뒤집어서 보관
      midPrice: mid,
      spread: diff,
      volumePower: power,
      tradesLog: _tradesLogList,
      lastPrice: _tradesLogList.isNotEmpty ? _tradesLogList.first.price : state.lastPrice,
    );
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _reconnectTimer?.cancel();
    super.dispose();
  }
}

/// 전역 프로바이더 정의
final exchangeProvider = StateNotifierProvider<ExchangeNotifier, ExchangeState>((ref) {
  return ExchangeNotifier();
});
