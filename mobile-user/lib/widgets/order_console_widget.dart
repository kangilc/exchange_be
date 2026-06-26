import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/exchange_provider.dart';

/// 💰 주문 콘솔 위젯 (Order Console Widget)
/// 
/// TradingTerminalScreen의 첫 번째 탭(주문)에 표시되는 UI입니다.
/// 매수(BUY)/매도(SELL) 탭 스위칭, 지정가/시장가 선택, 가격 및 수량 입력을 지원하며
/// 보유 자산 한도에 맞게 매칭 엔진으로 실제 주문을 발송하는 핵심 컴포넌트입니다.
class OrderConsoleWidget extends ConsumerStatefulWidget {
  const OrderConsoleWidget({super.key});

  @override
  ConsumerState<OrderConsoleWidget> createState() => _OrderConsoleWidgetState();
}

class _OrderConsoleWidgetState extends ConsumerState<OrderConsoleWidget> {
  // 사용자가 입력하는 가격 및 수량을 제어하는 텍스트 필드 컨트롤러
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _qtyController = TextEditingController();
  
  // 현재 선택된 매매 사이드 (true: 매수, false: 매도)
  bool _isBuy = true;
  // 주문 방식 (true: 지정가, false: 시장가)
  bool _isLimit = true;
  
  // 활성 심볼이 바뀔 때 초기값을 다시 설정하기 위한 이전 심볼 상태 캐싱
  String _lastSymbol = '';

  @override
  void dispose() {
    _priceController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  /// 주문 전송 버튼 클릭 시 동작하는 로직
  void _handleOrderSubmit(BuildContext context, WidgetRef ref) async {
    final state = ref.read(exchangeProvider);
    final isBtc = state.activeSymbol == 'BTC-USD';
    final fiat = isBtc ? 'USD' : 'KRW';

    // 시장가의 경우 사용자가 입력한 가격이 무시되므로, 현재가(lastPrice)를 렌더링/계산용으로 씁니다.
    final double price = _isLimit
        ? (double.tryParse(_priceController.text) ?? 0.0)
        : (state.lastPrice > 0 ? state.lastPrice : 0.0);
    final double qty = double.tryParse(_qtyController.text) ?? 0.0;

    // 입력값 기본 검증
    if (price <= 0 || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('가격과 수량을 올바르게 입력해주세요.', style: TextStyle(color: Colors.white)), backgroundColor: Color(0xFFEF4444)),
      );
      return;
    }

    final total = price * qty;
    // ExchangeProvider를 통해 주문 API/WebSocket 호출
    final bool success = await ref.read(exchangeProvider.notifier).sendOrder(
      side: _isBuy ? 'BUY' : 'SELL',
      price: price,
      qty: qty,
    );

    if (mounted) {
      if (success) {
        // 주문 성공 알림
        final sideText = _isBuy ? '매수' : '매도';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$sideText 주문이 성공적으로 접수되었습니다.\n총액: ${total.toStringAsFixed(2)} $fiat', style: const TextStyle(color: Colors.white)),
            backgroundColor: const Color(0xFF10B981),
            duration: const Duration(seconds: 2),
          ),
        );
      } else {
        // 주문 실패 (거절) 처리: ExchangeProvider에 저장된 lastRejectEvent 사유를 출력
        final currentState = ref.read(exchangeProvider);
        final rejectMsg = currentState.lastRejectEvent?['reason'] ?? '주문 전송에 실패했습니다. (잔고 부족 또는 서버 에러)';
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(rejectMsg, style: const TextStyle(color: Colors.white)),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 3),
          ),
        );
        ref.read(exchangeProvider.notifier).clearRejectEvent();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(exchangeProvider);
    final activeSymbol = state.activeSymbol;
    final isBtc = activeSymbol == 'BTC-USD';
    final fiat = isBtc ? 'USD' : 'KRW';
    final coin = isBtc ? 'BTC' : 'ADA';

    // 활성 심볼(코인)이 바뀔 때 폼 초기값을 각 코인에 맞는 더미 데이터로 리셋
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

    // 매수 시에는 피아트(원/달러), 매도 시에는 코인 자산 잔량을 기준으로 함
    final double balance = _isBuy ? (state.balances[fiat] ?? 0.0) : (state.balances[coin] ?? 0.0);
    
    // UI에 보여주기 위한 현재 평가 입력 가격 계산
    final double inputPrice = _isLimit 
        ? (double.tryParse(_priceController.text) ?? 0.0) 
        : (state.lastPrice > 0 ? state.lastPrice : 0.0);
    final double inputQty = double.tryParse(_qtyController.text) ?? 0.0;
    final double totalCost = inputPrice * inputQty;
    
    final format = NumberFormat('#,##0.##');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        // Glassmorphism 스타일 패널 (투명도 조절)
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFF0A1020).withOpacity(0.45),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ==== 1. 매수(BUY) / 매도(SELL) 탭 스위처 ====
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.02),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _isBuy = true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _isBuy ? const Color(0xFF10B981) : Colors.transparent, // 활성화 시 Emerald 색상
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: _isBuy ? [BoxShadow(color: const Color(0xFF10B981).withOpacity(0.3), blurRadius: 8)] : null,
                        ),
                        child: Text(
                          '매수 (BUY)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: _isBuy ? Colors.white : const Color(0xFF94A3B8),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _isBuy = false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: !_isBuy ? const Color(0xFFEF4444) : Colors.transparent, // 활성화 시 Rose 색상
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: !_isBuy ? [BoxShadow(color: const Color(0xFFEF4444).withOpacity(0.3), blurRadius: 8)] : null,
                        ),
                        child: Text(
                          '매도 (SELL)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: !_isBuy ? Colors.white : const Color(0xFF94A3B8),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ==== 2. 지정가 / 시장가 탭 스위처 ====
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _isLimit = true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _isLimit ? const Color(0xFF8A2BE2) : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text('지정가', style: TextStyle(fontSize: 11, color: _isLimit ? Colors.white : const Color(0xFF94A3B8))),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _isLimit = false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: !_isLimit ? const Color(0xFF8A2BE2) : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text('시장가', style: TextStyle(fontSize: 11, color: !_isLimit ? Colors.white : const Color(0xFF94A3B8))),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // ==== 3. 가격 입력 폼 ====
            const Text('주문 가격', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                // 시장가 선택 시 텍스트 박스를 비활성화 느낌으로 처리
                color: _isLimit ? Colors.black.withOpacity(0.3) : Colors.white.withOpacity(0.02),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _priceController,
                      enabled: _isLimit,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: TextStyle(color: _isLimit ? Colors.white : Colors.white30, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        hintText: _isLimit ? '' : '시장가 체결', // 시장가일 때 Placeholder
                        hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  Text(fiat, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ==== 4. 수량 입력 폼 ====
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('주문 수량', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.bold)),
                Text(
                  '주문가능: ${format.format(balance)} ${_isBuy ? fiat : coin}',
                  style: const TextStyle(color: Color(0xFF00F2FE), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.3),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _qtyController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  Text(coin, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ==== 5. 예상 주문 총액 요약 박스 ====
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.02),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('주문 총액', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.bold)),
                  Text(
                    !_isLimit ? 'MARKET PRICE' : '${format.format(totalCost)} $fiat',
                    style: const TextStyle(color: Color(0xFF00F2FE), fontSize: 16, fontWeight: FontWeight.w900, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ==== 6. 전송 액션 버튼 ====
            ElevatedButton(
              onPressed: () => _handleOrderSubmit(context, ref),
              style: ElevatedButton.styleFrom(
                // 매수/매도 상태에 따라 버튼 색상을 명확히 분리
                backgroundColor: _isBuy ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 10,
                shadowColor: (_isBuy ? const Color(0xFF10B981) : const Color(0xFFEF4444)).withOpacity(0.5),
              ),
              child: Text(
                _isBuy ? '매수 주문 전송' : '매도 주문 전송',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
