import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
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
  final Map<String, double> balances;

  // 인증 관련 상태
  final bool isAuthenticated;
  final String authEmail;
  final int authUserId;
  final String accessToken;
  final String refreshToken;

  // 계측 및 알림 관련 상태 추가
  final int latency;
  final int throughput;
  final Map<String, dynamic>? lastRejectEvent;

  ExchangeState({
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
    this.balances = const {'KRW': 0.0, 'USD': 0.0, 'BTC': 0.0, 'ADA': 0.0, 'JAF': 0.0},
    this.isAuthenticated = false,
    this.authEmail = '',
    this.authUserId = 1,
    this.accessToken = '',
    this.refreshToken = '',
    this.latency = 0,
    this.throughput = 0,
    this.lastRejectEvent,
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
    Map<String, double>? balances,
    bool? isAuthenticated,
    String? authEmail,
    int? authUserId,
    String? accessToken,
    String? refreshToken,
    int? latency,
    int? throughput,
    Map<String, dynamic>? lastRejectEvent,
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
      balances: balances ?? this.balances,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      authEmail: authEmail ?? this.authEmail,
      authUserId: authUserId ?? this.authUserId,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      latency: latency ?? this.latency,
      throughput: throughput ?? this.throughput,
      lastRejectEvent: lastRejectEvent != null ? (lastRejectEvent.isEmpty ? null : lastRejectEvent) : this.lastRejectEvent,
    );
  }
}

/// 전역 거래소 상태 관리자
class ExchangeNotifier extends StateNotifier<ExchangeState> {
  ExchangeNotifier() : super(ExchangeState()) {
    _setupDioInterceptor();
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

  // 스로틀링(Throttling) 및 계측용 타이머와 변수들
  Timer? _updateTimer;
  Timer? _pingTimer;
  Timer? _tpsTimer;
  bool _hasChanges = false;
  int _msgCount = 0;

  void _setupDioInterceptor() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (state.accessToken.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer ${state.accessToken}';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) async {
        if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
          if (state.refreshToken.isNotEmpty) {
            debugPrint("[Auth] 토큰 만료 감지. Refresh Token으로 갱신 시도 중...");
            try {
              final refreshDio = Dio();
              final refreshRes = await refreshDio.post(
                '${state.apiBaseUrl}/admin/auth/refresh',
                data: {'refreshToken': state.refreshToken},
              );

              if (refreshRes.statusCode == 200) {
                final newAccess = refreshRes.data['accessToken'];
                final newRefresh = refreshRes.data['refreshToken'];

                state = state.copyWith(
                  accessToken: newAccess,
                  refreshToken: newRefresh,
                );

                debugPrint("[Auth] 토큰 갱신 성공. 원래 요청 재시도.");
                // Update the authorization header
                e.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
                // Retry the request
                final retryRes = await _dio.fetch(e.requestOptions);
                return handler.resolve(retryRes);
              }
            } catch (err) {
              debugPrint("[Auth] Refresh Token 갱신 실패. 강제 로그아웃 됨. $err");
              logout();
              return handler.reject(e);
            }
          } else {
            logout();
          }
        }
        return handler.next(e);
      },
    ));
  }

  void initStore() async {
    // 1. --dart-define=API_HOST 로 빌드 시 주입한 호스트 우선 적용
    const String envHost = String.fromEnvironment('API_HOST', defaultValue: '');
    final String host = envHost.isNotEmpty
        ? envHost
        : ((!kIsWeb && Platform.isAndroid) ? '10.0.2.2' : '127.0.0.1');

    final String base = 'http://$host:8181';
    final String wsUrl = 'ws://$host:8088/ws';

    state = state.copyWith(apiBaseUrl: base, wsUrl: wsUrl);

    // 스냅샷 호출 및 웹소켓 연결
    await fetchFullSnapshot(state.activeSymbol);
    if (state.isAuthenticated) {
      await fetchUserBalances();
    }
    _connectWebSocket();
  }

  /// 활성 거래 대상 심볼 변경
  Future<void> setActiveSymbol(String symbol) async {
    _bidsMap.clear();
    _asksMap.clear();
    _tradesPowerWindow.clear();
    _tradesLogList = [];
    _hasChanges = true;

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
    if (state.isAuthenticated) {
      await fetchUserBalances();
    }
  }

  Future<void> fetchFullSnapshot(String symbol) async {
    final int port = symbol == 'BTC-USD' ? 9100 : 9101;
    final String host = Uri.parse(state.apiBaseUrl).host;
    final String url = 'http://$host:$port/snapshot';

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
        _hasChanges = true;
      }
    } catch (e) {
      debugPrint('[스냅샷 에러] $symbol 호가 동기화 실패: $e');
    }
  }

  void _startUpdateLoop() {
    _updateTimer?.cancel();
    _updateTimer = Timer.periodic(const Duration(milliseconds: 30), (_) {
      if (!_hasChanges) return;
      _updateOrderBookCalculations();
      _hasChanges = false;
    });
  }

  /// 바이너리 고성능 웹소켓 연결 수립
  void _connectWebSocket() {
    _subscription?.cancel();
    _channel?.sink.close();
    _reconnectTimer?.cancel();

    debugPrint('[웹소켓 연결 시도] ${state.wsUrl}');
    try {
      _channel = WebSocketChannel.connect(Uri.parse(state.wsUrl));
      state = state.copyWith(wsConnected: true);

      _subscription = _channel!.stream.listen(
        (data) {
          _msgCount++;
          if (data is Uint8List) {
            _handleBinaryMessage(data);
          } else if (data is String) {
            _handleTextMessage(data);
          }
        },
        onError: (err) {
          debugPrint('[웹소켓 에러] $err');
          _handleDisconnect();
        },
        onDone: () {
          debugPrint('[웹소켓 끊김]');
          _handleDisconnect();
        },
      );

      // PING 타이머 (2초 간격)
      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 2), (_) {
        if (state.wsConnected) {
          _channel?.sink.add(jsonEncode({
            'action': 'PING',
            'timestamp': DateTime.now().millisecondsSinceEpoch,
          }));
        }
      });

      // TPS 타미어 (1초 간격)
      _tpsTimer?.cancel();
      _tpsTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        state = state.copyWith(throughput: _msgCount);
        _msgCount = 0;
      });

      // 30ms 스로틀 렌더 루프 가동
      _startUpdateLoop();

    } catch (e) {
      debugPrint('[웹소켓 연결 예외] $e');
      _handleDisconnect();
    }
  }

  /// 웹소켓 끊김 시 3초 후 재연결 처리
  void _handleDisconnect() {
    state = state.copyWith(wsConnected: false);
    _pingTimer?.cancel();
    _tpsTimer?.cancel();
    _updateTimer?.cancel();
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      _connectWebSocket();
    });
  }

  /// 문자열 데이터 수신 처리 (PING/PONG, REJECT)
  void _handleTextMessage(String data) {
    try {
      final parsed = jsonDecode(data);
      if (parsed['action'] == 'PONG') {
        final rtt = DateTime.now().millisecondsSinceEpoch - (parsed['timestamp'] as int);
        state = state.copyWith(latency: rtt);
      } else if (parsed['action'] == 'REJECT') {
        debugPrint("[WS REJECT] 주문 거절 수신: $parsed");
        state = state.copyWith(
          lastRejectEvent: {
            'symbol': parsed['symbol'],
            'side': parsed['side'],
            'price': parsed['price'],
            'qty': parsed['qty'],
            'reason': parsed['reason'],
            'timestamp': DateTime.now().millisecondsSinceEpoch,
          }
        );
      }
    } catch (e) {
      // 파싱 무시
    }
  }

  void clearRejectEvent() {
    state = state.copyWith(lastRejectEvent: {}); // 전달 시 빈 Map은 null로 치환
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

    _hasChanges = true; // 변경 플래그 ON (30ms 루프에서 갱신 예정)
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

  /// 사용자 로그인 처리
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      // _dio 대신 기본 Dio 사용 (인터셉터 우회)
      final tempDio = Dio();
      final response = await tempDio.post(
        '${state.apiBaseUrl}/admin/auth/login',
        data: {'email': email, 'password': password},
      );
      if (response.statusCode == 200) {
        final data = response.data;
        final accessToken = data['accessToken'] ?? '';
        final refreshToken = data['refreshToken'] ?? '';
        final resEmail = data['email'] ?? email;

        int userId = 1;
        try {
          final parts = accessToken.split('.');
          if (parts.length > 1) {
            final String normalized = base64.normalize(parts[1]);
            final String decoded = utf8.decode(base64.decode(normalized));
            final Map<String, dynamic> payload = jsonDecode(decoded);
            if (payload['userId'] != null) {
              userId = (payload['userId'] as num).toInt();
            }
          }
        } catch (e) {
          debugPrint('[JWT 디코딩 에러] $e');
        }

        state = state.copyWith(
          isAuthenticated: true,
          authEmail: resEmail,
          authUserId: userId,
          accessToken: accessToken,
          refreshToken: refreshToken,
        );

        // 로그인에 연계해 잔고 동기화
        await fetchUserBalances();
        return {'success': true};
      }
      return {'success': false, 'message': '로그인 실패'};
    } catch (e) {
      debugPrint('[로그인 에러] $e');
      String msg = '서버에 연결할 수 없습니다.';
      if (e is DioException && e.response != null) {
        final respData = e.response?.data;
        if (respData is Map) {
          msg = respData['message'] ?? '이메일 또는 비밀번호가 올바르지 않습니다.';
        } else if (respData is String && respData.isNotEmpty) {
          msg = respData;
        } else {
          msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
        }
      }
      return {'success': false, 'message': msg};
    }
  }

  /// 로그아웃 처리
  Future<void> logout() async {
    try {
      if (state.authEmail.isNotEmpty) {
        await _dio.post(
          '${state.apiBaseUrl}/admin/auth/logout',
          data: {'email': state.authEmail},
        );
      }
    } catch (e) {
      debugPrint('[로그아웃 에러] $e');
    }

    state = state.copyWith(
      isAuthenticated: false,
      authEmail: '',
      authUserId: 1,
      accessToken: '',
      refreshToken: '',
      balances: {'KRW': 0.0, 'USD': 0.0, 'BTC': 0.0, 'ADA': 0.0, 'JAF': 0.0},
    );
  }

  /// 사용자 지갑 자산 실시간 조회 연동
  Future<void> fetchUserBalances() async {
    if (!state.isAuthenticated) return;
    try {
      // _dio 인스턴스를 사용하여 인터셉터 로직(RTR)이 자동으로 타도록 함
      final response = await _dio.get('${state.apiBaseUrl}/admin/wallets/me');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        final Map<String, double> newBalances = {};
        for (var item in data) {
          final String currency = item['currency'] ?? '';
          final double balance = double.tryParse(item['balance'].toString()) ?? 0.0;
          newBalances[currency] = balance;
        }
        state = state.copyWith(balances: newBalances);
      }
    } catch (e) {
      debugPrint('[잔고 에러] 지갑 자산 조회 실패: $e');
    }
  }

  /// 매칭 엔진으로 주문 전송 처리
  Future<bool> sendOrder({
    required String side,
    required double price,
    required double qty,
  }) async {
    if (_channel == null || !state.wsConnected) {
      debugPrint('[주문 에러] 웹소켓 미연결');
      return false;
    }

    final isBtc = state.activeSymbol == 'BTC-USD';
    final String fiat = isBtc ? 'USD' : 'KRW';
    final String coin = isBtc ? 'BTC' : 'ADA';

    final double totalCost = price * qty;

    // 1. 자산 검증
    final double available = side == 'BUY' ? (state.balances[fiat] ?? 0.0) : (state.balances[coin] ?? 0.0);
    final double requiredAmt = side == 'BUY' ? totalCost : qty;

    if (available < requiredAmt) {
      debugPrint('[주문 거부] 잔고 부족: 필요 $requiredAmt, 가용 $available');
      // 로컬 UI에서도 REJECT 처리
      state = state.copyWith(lastRejectEvent: {
        'symbol': state.activeSymbol,
        'side': side,
        'price': price,
        'qty': qty,
        'reason': '잔고가 부족합니다.',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
      return false;
    }

    // 2. 서버 자산 가감 처리 (이 호출도 _dio를 통하므로 RTR 자동 지원)
    try {
      final double fiatDelta = side == 'BUY' ? -totalCost : totalCost;
      final double coinDelta = side == 'BUY' ? qty : -qty;

      await _dio.post(
        '${state.apiBaseUrl}/admin/users/${state.authUserId}/assets/adjust',
        data: {'currency': fiat, 'amount': fiatDelta},
      );
      await _dio.post(
        '${state.apiBaseUrl}/admin/users/${state.authUserId}/assets/adjust',
        data: {'currency': coin, 'amount': coinDelta},
      );
    } catch (e) {
      debugPrint('[자산 동기화 에러] $e');
    }

    // 3. 웹소켓 매칭엔진 주문 발송
    try {
      final int scaledPrice = (price * 100).round();
      final Map<String, dynamic> payload = {
        'action': 'NEW',
        'symbol': state.activeSymbol,
        'side': side,
        'price': scaledPrice,
        'qty': qty.round(),
      };
      _channel!.sink.add(jsonEncode(payload));
      
      // 1.5초 후 자산 리로드
      Future.delayed(const Duration(milliseconds: 1500), () {
        fetchUserBalances();
      });
      return true;
    } catch (e) {
      debugPrint('[웹소켓 주문 전송 에러] $e');
    }
    return false;
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _channel?.sink.close();
    _reconnectTimer?.cancel();
    _updateTimer?.cancel();
    _pingTimer?.cancel();
    _tpsTimer?.cancel();
    super.dispose();
  }
}

/// 전역 프로바이더 정의
final exchangeProvider = StateNotifierProvider<ExchangeNotifier, ExchangeState>((ref) {
  return ExchangeNotifier();
});

