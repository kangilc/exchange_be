import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/exchange_provider.dart';

/// ⚡ 실시간 체결 내역 위젯 (Recent Trades Widget - Tab 4)
/// 
/// 매칭 엔진(Engine Core)에서 처리된 체결 결과 로그를 실시간으로 리스트뷰 형태로 보여줍니다.
/// 웹소켓에서 수량(qty)이 음수(-)인 경우를 체결로 간주하여 state.tradesLog 에 쌓으며,
/// 매수(BUY) 및 매도(SELL)에 따라 글씨 색상을 다르게 표현합니다.
class RecentTradesWidget extends ConsumerWidget {
  const RecentTradesWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 실시간 상태 구독
    final state = ref.watch(exchangeProvider);
    final trades = state.tradesLog;

    // 포맷터 설정
    final priceFormat = NumberFormat.decimalPattern();
    final timeFormat = DateFormat('HH:mm:ss');
    final isBtc = state.activeSymbol == 'BTC-USD';
    final fiat = isBtc ? 'USD' : 'KRW';
    final coin = isBtc ? 'BTC' : 'ADA';

    return Container(
      color: const Color(0xFF0A1020), // 다크 톤 배경
      child: Column(
        children: [
          // ==== 1. 리스트 컬럼 헤더 ====
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.02),
              border: const Border(bottom: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              children: [
                const Expanded(flex: 2, child: Text('시간', style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold))),
                Expanded(flex: 3, child: Text('가격 ($fiat)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold))),
                Expanded(flex: 3, child: Text('체결량 ($coin)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold))),
              ],
            ),
          ),

          // ==== 2. 체결 내역 리스트뷰 ====
          // 내역이 비어있을 경우 안내 문구 노출
          if (trades.isEmpty)
            Expanded(
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.receipt_long_rounded, size: 48, color: Colors.white.withOpacity(0.1)),
                    const SizedBox(height: 16),
                    Text('실시간 체결 내역이 없습니다.', style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12)),
                  ],
                ),
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 4),
                itemCount: trades.length,
                itemBuilder: (context, index) {
                  final trade = trades[index];
                  final isBuy = trade.side == 'BUY';
                  // 매수는 에메랄드(초록), 매도는 로즈(빨강) 색상 지정
                  final textColor = isBuy ? const Color(0xFF10B981) : const Color(0xFFEF4444);

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    // 최근에 추가된 내역에 약간의 틴트(Tint) 효과를 주는 등 확장 가능
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.02))),
                    ),
                    child: Row(
                      children: [
                        // 체결 발생 시각 (HH:mm:ss 포맷)
                        Expanded(
                          flex: 2,
                          child: Text(
                            timeFormat.format(trade.executedAt),
                            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontFamily: 'monospace'),
                          ),
                        ),
                        // 체결 가격
                        Expanded(
                          flex: 3,
                          child: Text(
                            priceFormat.format(trade.price),
                            textAlign: TextAlign.right,
                            style: TextStyle(color: textColor, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                          ),
                        ),
                        // 체결 수량
                        Expanded(
                          flex: 3,
                          child: Text(
                            trade.qty.toStringAsFixed(4), // 수량은 소수점 4자리까지 고정 노출
                            textAlign: TextAlign.right,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
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
    );
  }
}
