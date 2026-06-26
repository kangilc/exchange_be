import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/exchange_provider.dart';

/// 📚 호가창 위젯 (Order Book Widget - Tab 2)
/// 
/// 웹소켓을 통해 실시간으로 들어오는 바이너리 기반의 10단 매수/매도 호가를 렌더링합니다.
/// 데이터 변경 시 수량 박스가 깜빡이는 (Flashing) 애니메이션이 적용되어 있으며,
/// 직관적인 누적 잔량 바(Bar) 형태를 배경으로 깔아 시장 상황을 한눈에 볼 수 있도록 구성했습니다.
class OrderBookWidget extends ConsumerStatefulWidget {
  const OrderBookWidget({super.key});

  @override
  ConsumerState<OrderBookWidget> createState() => _OrderBookWidgetState();
}

class _OrderBookWidgetState extends ConsumerState<OrderBookWidget> {
  // 이전 수량과 비교하여 변경 감지용 (깜빡임 이펙트를 주기 위함)
  final Map<double, int> _prevQuantities = {};
  // 특정 가격대의 마지막 플래시(깜빡임) 발생 시각을 기록
  final Map<double, DateTime> _flashTimes = {};

  @override
  Widget build(BuildContext context) {
    // 30ms 주기로 스로틀링되어 갱신되는 전역 호가 상태를 관찰합니다.
    final state = ref.watch(exchangeProvider);
    final activeSymbol = state.activeSymbol;
    final isBtc = activeSymbol == 'BTC-USD';
    final fiat = isBtc ? 'USD' : 'KRW';
    final coin = isBtc ? 'BTC' : 'ADA';

    final priceFormat = NumberFormat.decimalPattern();

    // ==== 1. 데이터 변경 감지 및 플래시(깜빡임) 타이머 설정 로직 ====
    // 매도(Asks) 호가 변경 감지
    state.asks.forEach((priceCents, qty) {
      final double price = priceCents / 100.0;
      if (_prevQuantities.containsKey(price) && _prevQuantities[price] != qty) {
        _flashTimes[price] = DateTime.now();
        // 400ms 후 플래시 효과를 끄기 위해 리빌드(setState) 스케줄링
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted) setState(() {});
        });
      }
      _prevQuantities[price] = qty;
    });

    // 매수(Bids) 호가 변경 감지
    state.bids.forEach((priceCents, qty) {
      final double price = priceCents / 100.0;
      if (_prevQuantities.containsKey(price) && _prevQuantities[price] != qty) {
        _flashTimes[price] = DateTime.now();
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted) setState(() {});
        });
      }
      _prevQuantities[price] = qty;
    });

    // ==== 2. 최대 수량 계산 ====
    // 배경에 그릴 누적 바(Bar)의 최대 폭을 결정하기 위해 전체 매수/매도 중 가장 큰 잔량을 찾습니다.
    int maxQty = 1;
    for (var qty in state.bids.values) maxQty = max(maxQty, qty);
    for (var qty in state.asks.values) maxQty = max(maxQty, qty);

    return Container(
      color: const Color(0xFF0A1020), // 다크 톤 배경
      child: Column(
        children: [
          // ==== 3. 호가창 컬럼 헤더 ====
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
            color: Colors.white.withOpacity(0.02),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text('가격 ($fiat)', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ),
                Expanded(
                  flex: 3,
                  child: Text('수량 ($coin)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ),
                Expanded(
                  flex: 4,
                  child: Text('누적 ($coin)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                ),
              ],
            ),
          ),

          // ==== 4. 매도 호가 (Asks) 영역 ====
          // 상단에 위치하며 오름차순 리스트를 역순(Reverse)으로 배치하여 높은 가격이 위로 가게 함
          Expanded(
            child: ListView(
              reverse: true,
              physics: const ClampingScrollPhysics(), // 스크롤 바운스 효과 제거
              children: () {
                final entries = state.asks.entries.toList();
                int cum = 0;
                final List<int> cums = List.filled(entries.length, 0);
                // 누적 잔량 계산 (역순으로 내려갈수록 더해짐)
                for (int i = 0; i < entries.length; i++) {
                  cum += entries[i].value;
                  cums[i] = cum;
                }
                return List.generate(entries.length, (idx) {
                  final entry = entries[idx];
                  final double price = entry.key / 100.0;
                  final int qty = entry.value;
                  final double barWidthPercent = qty / maxQty;
                  return _buildOrderbookRow(
                    price: price,
                    qty: qty,
                    cumQty: cums[idx],
                    isAsk: true,
                    barWidthPercent: barWidthPercent,
                    priceFormat: priceFormat,
                  );
                });
              }(),
            ),
          ),

          // ==== 5. 중앙 스프레드 / 미드 프라이스 영역 ====
          // 매도 1호가와 매수 1호가 사이의 간격을 직관적으로 보여줌
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.4),
              border: const Border.symmetric(horizontal: BorderSide(color: Colors.white10)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '스프레드 (Spread)',
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                ),
                Text(
                  '${priceFormat.format(state.spread)} $fiat',
                  style: const TextStyle(fontSize: 14, fontFamily: 'monospace', color: Color(0xFF00F2FE), fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          // ==== 6. 매수 호가 (Bids) 영역 ====
          // 하단에 위치하며 내림차순 리스트 그대로 배치
          Expanded(
            child: ListView(
              physics: const ClampingScrollPhysics(),
              children: () {
                final entries = state.bids.entries.toList();
                int cum = 0;
                final List<int> cums = List.filled(entries.length, 0);
                for (int i = 0; i < entries.length; i++) {
                  cum += entries[i].value;
                  cums[i] = cum;
                }
                return List.generate(entries.length, (idx) {
                  final entry = entries[idx];
                  final double price = entry.key / 100.0;
                  final int qty = entry.value;
                  final double barWidthPercent = qty / maxQty;
                  return _buildOrderbookRow(
                    price: price,
                    qty: qty,
                    cumQty: cums[idx],
                    isAsk: false,
                    barWidthPercent: barWidthPercent,
                    priceFormat: priceFormat,
                  );
                });
              }(),
            ),
          ),
        ],
      ),
    );
  }

  /// 공통 호가 단일 로우(Row)를 렌더링하는 헬퍼 메서드
  /// 깜빡임(Flashing) 효과와 잔량 바(Bar)를 겹쳐서(Stack) 표현합니다.
  Widget _buildOrderbookRow({
    required double price,
    required int qty,
    required int cumQty,
    required bool isAsk,
    required double barWidthPercent,
    required NumberFormat priceFormat,
  }) {
    // 매도는 붉은색, 매수는 초록색 계열 색상 지정
    final Color textColor = isAsk ? const Color(0xFFEF4444) : const Color(0xFF10B981);
    final Color barColor = isAsk ? const Color(0xFFEF4444).withOpacity(0.15) : const Color(0xFF10B981).withOpacity(0.15);

    // 플래시 효과 활성화 여부 계산 (300ms 이내에 변경이 있었으면 깜빡임 배경 활성)
    final DateTime? lastFlash = _flashTimes[price];
    final bool isFlashing = lastFlash != null && DateTime.now().difference(lastFlash).inMilliseconds < 300;
    final Color bgColor = isFlashing ? textColor.withOpacity(0.3) : Colors.transparent;

    return Container(
      height: 36,
      color: bgColor,
      child: Stack(
        children: [
          // 1. 누적 잔량 시각화 바 (배경에 오른쪽 정렬로 배치)
          Align(
            alignment: Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: barWidthPercent > 1.0 ? 1.0 : barWidthPercent,
              child: Container(color: barColor),
            ),
          ),
          // 2. 가격 및 수량 텍스트 레이어
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    priceFormat.format(price),
                    style: TextStyle(
                      color: textColor,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace', // 숫자 정렬을 위해 고정폭 글꼴 사용
                    ),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    qty.toString(),
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                Expanded(
                  flex: 4,
                  child: Text(
                    cumQty.toString(),
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.6),
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
