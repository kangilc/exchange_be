import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'providers/exchange_provider.dart';

void main() {
  runApp(
    const ProviderScope(
      child: JavaFExchangeApp(),
    ),
  );
}

class JavaFExchangeApp extends StatelessWidget {
  const JavaFExchangeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JavaF Mobile Exchange',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF070B15),
      ),
      home: const TradingTerminalPage(),
    );
  }
}

class TradingTerminalPage extends ConsumerStatefulWidget {
  const TradingTerminalPage({super.key});

  @override
  ConsumerState<TradingTerminalPage> createState() => _TradingTerminalPageState();
}

class _TradingTerminalPageState extends ConsumerState<TradingTerminalPage> {
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _qtyController = TextEditingController();
  bool _isBuy = true;
  bool _isLimit = true;
  String _lastSymbol = '';

  @override
  void dispose() {
    _priceController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String suffix,
    bool enabled = true,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: enabled ? const Color(0xFF0F172A) : const Color(0xFF1E293B).withOpacity(0.5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                labelText: label,
                labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Text(
            suffix,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(exchangeProvider);
    final notifier = ref.read(exchangeProvider.notifier);

    final String activeSymbol = state.activeSymbol;
    final bool isBtc = activeSymbol == 'BTC-USD';
    final String fiat = isBtc ? 'USD' : 'KRW';
    final String coin = isBtc ? 'BTC' : 'ADA';

    // 활성 심볼 변경 감지 시 입력값 초기화
    if (_lastSymbol != activeSymbol) {
      _lastSymbol = activeSymbol;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        setState(() {
          if (activeSymbol == 'BTC-USD') {
            _priceController.text = '65000';
            _qtyController.text = '1';
          } else {
            _priceController.text = '1200';
            _qtyController.text = '500';
          }
        });
      });
    }

    final priceFormat = NumberFormat.decimalPattern();
    final qtyFormat = NumberFormat('#,##0.####');

    // 오더북 최대 수량 연산 (막대 폭 비율용)
    int maxQty = 1;
    for (var qty in state.bids.values) {
      maxQty = max(maxQty, qty);
    }
    for (var qty in state.asks.values) {
      maxQty = max(maxQty, qty);
    }

    // 가용 잔고 및 총액 계산
    final double balance = _isBuy ? (state.balances[fiat] ?? 0.0) : (state.balances[coin] ?? 0.0);
    final double inputPrice = _isLimit 
        ? (double.tryParse(_priceController.text) ?? 0.0) 
        : (state.lastPrice > 0 ? state.lastPrice : 0.0);
    final double inputQty = double.tryParse(_qtyController.text) ?? 0.0;
    final double totalCost = inputPrice * inputQty;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A1020),
        elevation: 0,
        title: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8A2BE2), Color(0xFF00F2FE)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF8A2BE2).withOpacity(0.5),
                      blurRadius: 8,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'JavaF Mobile',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF00F2FE).withOpacity(0.4)),
                  color: const Color(0xFF00F2FE).withOpacity(0.05),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'USER CLIENT',
                  style: TextStyle(
                    fontSize: 8,
                    color: Color(0xFF00F2FE),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          // 연결상태 뱃지
          Container(
            margin: const EdgeInsets.only(right: 16),
            alignment: Alignment.center,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: state.wsConnected
                    ? const Color(0xFF10B981).withOpacity(0.08)
                    : const Color(0xFFEF4444).withOpacity(0.08),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: state.wsConnected
                      ? const Color(0xFF10B981).withOpacity(0.35)
                      : const Color(0xFFEF4444).withOpacity(0.35),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: state.wsConnected
                          ? const Color(0xFF10B981)
                          : const Color(0xFFEF4444),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    state.wsConnected ? 'CONNECTED' : 'DISCONNECTED',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      color: state.wsConnected
                          ? const Color(0xFF10B981)
                          : const Color(0xFFEF4444),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 🌌 1. 심볼 체인저 탭
            Container(
              padding: const EdgeInsets.all(8),
              color: const Color(0xFF0A1020).withOpacity(0.5),
              child: Row(
                children: [
                  _buildSymbolTabButton(
                    active: activeSymbol == 'BTC-USD',
                    title: 'BTC-USD',
                    onTap: () => notifier.setActiveSymbol('BTC-USD'),
                  ),
                  const SizedBox(width: 8),
                  _buildSymbolTabButton(
                    active: activeSymbol == 'ADA-KRW',
                    title: 'ADA-KRW',
                    onTap: () => notifier.setActiveSymbol('ADA-KRW'),
                  ),
                  const Spacer(),
                  // 현재 시세
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        '현재가',
                        style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8)),
                      ),
                      Text(
                        state.lastPrice > 0
                            ? '${priceFormat.format(state.lastPrice)} $fiat'
                            : '계측 중...',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF00F2FE),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // 2. 오더북 & 주문 영역
            Expanded(
              child: Row(
                children: [
                  // 좌측: 오더북 10단
                  Expanded(
                    flex: 6,
                    child: Container(
                      decoration: const BoxDecoration(
                        border: Border(
                          right: BorderSide(color: Colors.white10),
                        ),
                      ),
                      child: Column(
                        children: [
                          // 오더북 헤더
                          Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 6,
                              horizontal: 8,
                            ),
                            color: Colors.white.withOpacity(0.02),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('가격 ($fiat)',
                                    style: const TextStyle(
                                        fontSize: 9, color: Color(0xFF64748B))),
                                Text('수량 ($coin)',
                                    style: const TextStyle(
                                        fontSize: 9, color: Color(0xFF64748B))),
                              ],
                            ),
                          ),
                          
                          // 매도 호가 (Asks)
                          Expanded(
                            child: ListView(
                              reverse: true,
                              physics: const ClampingScrollPhysics(),
                              children: state.asks.entries.map((entry) {
                                final double price = entry.key / 100.0;
                                final int qty = entry.value;
                                final double barWidthPercent = qty / maxQty;
                                return _buildOrderbookRow(
                                  price: price,
                                  qty: qty,
                                  isAsk: true,
                                  barWidthPercent: barWidthPercent,
                                  priceFormat: priceFormat,
                                );
                              }).toList(),
                            ),
                          ),
                          
                          // 스프레드 바
                          Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 8,
                              horizontal: 10,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.4),
                              border: const Border.symmetric(
                                horizontal: BorderSide(color: Colors.white10),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  '스프레드',
                                  style: TextStyle(
                                    fontSize: 8,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  '${priceFormat.format(state.spread)} $fiat',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontFamily: 'monospace',
                                    color: Color(0xFF00F2FE),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // 매수 호가 (Bids)
                          Expanded(
                            child: ListView(
                              physics: const ClampingScrollPhysics(),
                              children: state.bids.entries.map((entry) {
                                final double price = entry.key / 100.0;
                                final int qty = entry.value;
                                final double barWidthPercent = qty / maxQty;
                                return _buildOrderbookRow(
                                  price: price,
                                  qty: qty,
                                  isAsk: false,
                                  barWidthPercent: barWidthPercent,
                                  priceFormat: priceFormat,
                                );
                              }).toList(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // 우측: 주문 패널 & 체결 내역
                  Expanded(
                    flex: 5,
                    child: Column(
                      children: [
                        // ⚡ 주문 입력 패널
                        Container(
                          padding: const EdgeInsets.all(8.0),
                          decoration: const BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: Colors.white10),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // 매수 / 매도 탭
                              Row(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => setState(() => _isBuy = true),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 6),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: _isBuy ? const Color(0xFF10B981).withOpacity(0.15) : Colors.transparent,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(
                                            color: _isBuy ? const Color(0xFF10B981) : Colors.transparent,
                                          ),
                                        ),
                                        child: const Text('매수', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => setState(() => _isBuy = false),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 6),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: !_isBuy ? const Color(0xFFEF4444).withOpacity(0.15) : Colors.transparent,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(
                                            color: !_isBuy ? const Color(0xFFEF4444) : Colors.transparent,
                                          ),
                                        ),
                                        child: const Text('매도', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFEF4444))),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              // 지정가 / 시장가 선택
                              Row(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => setState(() => _isLimit = true),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 4),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: _isLimit ? Colors.white12 : Colors.transparent,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text('지정가', style: TextStyle(fontSize: 10, color: Colors.white)),
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => setState(() => _isLimit = false),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(vertical: 4),
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: !_isLimit ? Colors.white12 : Colors.transparent,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text('시장가', style: TextStyle(fontSize: 10, color: Colors.white)),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              // 가격 입력
                              _buildTextField(
                                controller: _priceController,
                                label: '주문 가격',
                                suffix: fiat,
                                enabled: _isLimit,
                              ),
                              // 수량 입력
                              _buildTextField(
                                controller: _qtyController,
                                label: '주문 수량',
                                suffix: coin,
                              ),
                              const SizedBox(height: 6),
                              // 가용 잔고 정보
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('가능 자산', style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
                                  Text(
                                    '${priceFormat.format(balance)} ${_isBuy ? fiat : coin}',
                                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              // 총액 정보
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('예상 총액', style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
                                  Text(
                                    '${priceFormat.format(totalCost)} $fiat',
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF00F2FE)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              // 주문 전송 버튼
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _isBuy ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                  elevation: 2,
                                ),
                                onPressed: () async {
                                  final messenger = ScaffoldMessenger.of(context);
                                  final double p = _isLimit 
                                      ? (double.tryParse(_priceController.text) ?? 0.0)
                                      : (state.lastPrice > 0 ? state.lastPrice : 0.0);
                                  final double q = double.tryParse(_qtyController.text) ?? 0.0;

                                  if (p <= 0 || q <= 0) {
                                    messenger.showSnackBar(
                                      const SnackBar(content: Text('가격과 수량을 바르게 입력해주세요.')),
                                    );
                                    return;
                                  }

                                  final success = await notifier.sendOrder(
                                    side: _isBuy ? 'BUY' : 'SELL',
                                    price: p,
                                    qty: q,
                                  );

                                  if (success) {
                                    messenger.showSnackBar(
                                      SnackBar(content: Text('${_isBuy ? "매수" : "매도"} 주문 전송 성공!')),
                                    );
                                  } else {
                                    messenger.showSnackBar(
                                      const SnackBar(content: Text('주문 실패: 잔고가 부족하거나 서버와 연결되어 있지 않습니다.')),
                                    );
                                  }
                                },
                                child: Text(
                                  _isBuy ? '매수하기 (BUY)' : '매도하기 (SELL)',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ),
                        // 체결강도 정보
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.01),
                            border: const Border(
                              bottom: BorderSide(color: Colors.white10),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('체결강도',
                                  style: TextStyle(
                                      fontSize: 10, color: Color(0xFF94A3B8))),
                              Text(
                                '${state.volumePower.toStringAsFixed(1)}%',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFC084FC),
                                ),
                              ),
                            ],
                          ),
                        ),

                        // 실시간 체결 로그 목록
                        Expanded(
                          child: state.tradesLog.isEmpty
                              ? const Center(
                                  child: Text(
                                    '체결 데이터 대기 중...',
                                    style: TextStyle(
                                        fontSize: 10, color: Color(0xFF64748B)),
                                  ),
                                )
                              : ListView.builder(
                                  itemCount: state.tradesLog.length,
                                  itemBuilder: (context, index) {
                                    final log = state.tradesLog[index];
                                    final String timeStr =
                                        DateFormat('HH:mm:ss')
                                            .format(log.executedAt);
                                    final bool isBuy = log.side == 'BUY';
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 4,
                                        horizontal: 8,
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            timeStr,
                                            style: const TextStyle(
                                              fontSize: 9,
                                              color: Color(0xFF64748B),
                                              fontFamily: 'monospace',
                                            ),
                                          ),
                                          Text(
                                            priceFormat.format(log.price),
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: isBuy
                                                  ? const Color(0xFF10B981)
                                                  : const Color(0xFFEF4444),
                                            ),
                                          ),
                                          Text(
                                            qtyFormat.format(log.qty),
                                            style: const TextStyle(
                                              fontSize: 9,
                                              color: Color(0xFFCBD5E1),
                                              fontFamily: 'monospace',
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 탭 전환 버튼 렌더러
  Widget _buildSymbolTabButton({
    required bool active,
    required String title,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF8A2BE2) : Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? Colors.transparent : Colors.white10,
          ),
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: active ? Colors.white : const Color(0xFFCBD5E1),
          ),
        ),
      ),
    );
  }

  /// 오더북 개별 호가 렌더러 (막대 그래프 렌더링 포함)
  Widget _buildOrderbookRow({
    required double price,
    required int qty,
    required bool isAsk,
    required double barWidthPercent,
    required NumberFormat priceFormat,
  }) {
    final color = isAsk ? const Color(0xFFEF4444) : const Color(0xFF10B981);
    final bgColor = isAsk
        ? const Color(0xFFEF4444).withOpacity(0.12)
        : const Color(0xFF10B981).withOpacity(0.12);

    return LayoutBuilder(
      builder: (context, constraints) {
        final double maxBarWidth = constraints.maxWidth;
        final double currentBarWidth = maxBarWidth * barWidthPercent;

        return GestureDetector(
          onTap: () {
            setState(() {
              _priceController.text = price.toString();
              _isLimit = true;
            });
          },
          child: Stack(
            alignment: isAsk ? Alignment.centerLeft : Alignment.centerRight,
            children: [
              // 백그라운드 볼륨 바
              Container(
                width: currentBarWidth,
                height: 24,
                color: bgColor,
              ),
              // 실데이터 텍스트
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      priceFormat.format(price),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'monospace',
                        color: color,
                      ),
                    ),
                    Text(
                      qty.toString(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
