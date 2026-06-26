import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/exchange_provider.dart';

/// 📈 차트 위젯 플레이스홀더 (Chart Placeholder Widget - Tab 3)
/// 
/// 웹 버전의 TradingView 차트를 모바일에 완벽히 이식하기 전 임시로 사용되는 뷰입니다.
/// 실시간 현재가를 중앙에 크게 노출하며, 차트 라이브러리 연동 준비 상태를 나타냅니다.
/// 향후 웹뷰(WebView) 또는 모바일 네이티브 차트(e.g., fl_chart, k_chart)로 교체될 예정입니다.
class ChartPlaceholderWidget extends ConsumerWidget {
  const ChartPlaceholderWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 실시간 상태를 구독하여 현재가 및 종목 정보 출력
    final state = ref.watch(exchangeProvider);
    final isBtc = state.activeSymbol == 'BTC-USD';
    final fiat = isBtc ? 'USD' : 'KRW';

    return Container(
      color: const Color(0xFF070B15),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // 차트 아이콘 장식 (글래스모피즘 네온 테마)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF00F2FE).withOpacity(0.05),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00F2FE).withOpacity(0.1),
                  blurRadius: 30,
                  spreadRadius: 10,
                )
              ],
            ),
            child: const Icon(Icons.candlestick_chart_rounded, size: 64, color: Color(0xFF00F2FE)),
          ),
          const SizedBox(height: 32),
          
          // 현재가 하이라이트
          const Text(
            '실시간 현재가',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            state.lastPrice > 0 ? '${state.lastPrice.toStringAsFixed(2)} $fiat' : '대기 중...',
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 32),

          // 안내 메시지 박스
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A).withOpacity(0.8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded, color: Color(0xFF8A2BE2), size: 24),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '모바일 네이티브 캔들 차트는 다음 릴리즈에 추가될 예정입니다.',
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, height: 1.5),
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
