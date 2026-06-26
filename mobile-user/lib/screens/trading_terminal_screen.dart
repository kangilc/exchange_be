import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/exchange_provider.dart';
import '../widgets/order_console_widget.dart';
import '../widgets/order_book_widget.dart';
import '../widgets/chart_placeholder_widget.dart';
import '../widgets/recent_trades_widget.dart';

/// 📊 종목 상세 거래 터미널 (Trading Terminal Screen)
/// 
/// 웹 기반의 frontend-user 모바일 뷰와 동일하게, 상단에 종목 요약 정보와
/// 웹소켓 상태를 배치하고, 하단은 4개의 탭(주문, 호가, 차트, 체결) 구조로 분리하여
/// 복잡한 거래소 데이터를 모바일 화면에 직관적으로 렌더링합니다.
class TradingTerminalScreen extends ConsumerStatefulWidget {
  const TradingTerminalScreen({super.key});

  @override
  ConsumerState<TradingTerminalScreen> createState() => _TradingTerminalScreenState();
}

class _TradingTerminalScreenState extends ConsumerState<TradingTerminalScreen> with SingleTickerProviderStateMixin {
  // 탭 화면 전환 애니메이션 및 상태를 관리하는 컨트롤러
  late TabController _tabController;
  final priceFormat = NumberFormat.decimalPattern();

  @override
  void initState() {
    super.initState();
    // 사용자 요청에 따라 탭 순서를 재배치했습니다: 1.주문, 2.호가, 3.차트, 4.체결
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    // 메모리 누수 방지를 위한 컨트롤러 정리
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 전역 거래소 상태를 구독하여 상단 앱바에 활성 종목(activeSymbol), 
    // 라이브 연결 상태(wsConnected), 실시간 현재가(lastPrice)를 표시합니다.
    final state = ref.watch(exchangeProvider);
    final activeSymbol = state.activeSymbol;
    final isBtc = activeSymbol == 'BTC-USD';
    final fiat = isBtc ? 'USD' : 'KRW'; // 기준 통화 표기용

    return Scaffold(
      backgroundColor: const Color(0xFF070B15), // 다크 네이비 배경 적용
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A1020),
        elevation: 0,
        // 뒤로가기 버튼 커스텀 스타일
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        // 앱바 타이틀 영역: 심볼과 WS Live 상태 뱃지
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              activeSymbol,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(width: 8),
            // WS Live 뱃지 (상태에 따라 초록색/빨간색 스위칭)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: state.wsConnected
                    ? const Color(0xFF10B981).withOpacity(0.1)
                    : const Color(0xFFEF4444).withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: state.wsConnected
                      ? const Color(0xFF10B981).withOpacity(0.3)
                      : const Color(0xFFEF4444).withOpacity(0.3),
                ),
              ),
              child: Text(
                state.wsConnected ? 'LIVE' : 'DOWN',
                style: TextStyle(
                  fontSize: 8,
                  fontWeight: FontWeight.bold,
                  color: state.wsConnected ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                ),
              ),
            ),
          ],
        ),
        actions: [
          // 현재가 요약 패널 (실시간 변동)
          Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('현재가', style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
                Text(
                  state.lastPrice > 0 ? '${priceFormat.format(state.lastPrice)} $fiat' : '대기 중',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF00F2FE),
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          )
        ],
        // 앱바 하단에 붙는 탭 바 (주문, 호가, 차트, 체결)
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF8A2BE2), // 네온 퍼플 인디케이터
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF64748B),
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          tabs: const [
            Tab(text: '주문'), // Tab 1
            Tab(text: '호가'), // Tab 2
            Tab(text: '차트'), // Tab 3
            Tab(text: '체결'), // Tab 4
          ],
        ),
      ),
      // 탭 선택에 따라 하위 위젯 렌더링
      body: TabBarView(
        controller: _tabController,
        children: [
          // 탭 1: 주문
          const OrderConsoleWidget(),
          // 탭 2: 호가
          const OrderBookWidget(),
          // 탭 3: 차트
          const ChartPlaceholderWidget(),
          // 탭 4: 체결
          const RecentTradesWidget(),
        ],
      ),
    );
  }
}
