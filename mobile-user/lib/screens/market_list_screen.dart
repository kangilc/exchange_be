import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../providers/exchange_provider.dart';
import 'trading_terminal_screen.dart';

/// 📈 종목 목록 첫 화면 (Market List Screen)
/// 
/// 로그인 성공 후 사용자가 처음 마주하게 되는 화면입니다.
/// 웹 기반의 frontend-user 와 통일성을 맞추기 위해 네온 컬러(Neon Color)와
/// 다크 테마(Dark Theme), 그리고 약간의 투명도가 들어간 글래스모피즘(Glassmorphism) 
/// 박스를 활용하여 디자인되었습니다.
class MarketListScreen extends ConsumerWidget {
  const MarketListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 전역 상태(ExchangeState)를 구독하여 자산 변동 사항을 실시간으로 가져옵니다.
    final state = ref.watch(exchangeProvider);
    final notifier = ref.read(exchangeProvider.notifier);

    // 보유 자산을 보기 좋게 출력하기 위한 포맷터 (예: 1,234.5678)
    final qtyFormat = NumberFormat('#,##0.####');

    // 모바일 환경에서 제공되는 거래 가능 마켓 리스트 하드코딩
    // 백엔드의 Snapshot 서버 포트 분리 규칙에 맞게 구성되었습니다.
    final markets = [
      {
        'symbol': 'BTC-USD',
        'name': 'Bitcoin',
        'coin': 'BTC',
        'fiat': 'USD',
        'icon': Icons.currency_bitcoin_rounded,
        'color': const Color(0xFFF7931A), // 비트코인 고유 오렌지색
      },
      {
        'symbol': 'ADA-KRW',
        'name': 'Cardano',
        'coin': 'ADA',
        'fiat': 'KRW',
        'icon': Icons.change_history_rounded, // 에이다 아이콘 대체
        'color': const Color(0xFF0033AD), // 에이다 고유 블루
      },
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF070B15), // 다크 네이비 배경
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A1020),
        elevation: 0,
        title: Row(
          children: [
            // 앱 로고 (그라데이션 원형)
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFF8A2BE2), Color(0xFF00F2FE)],
                ),
                boxShadow: [
                  BoxShadow(color: const Color(0xFF8A2BE2).withOpacity(0.5), blurRadius: 8),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'JavaF Markets',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ],
        ),
        actions: [
          // 로그아웃 버튼
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white54, size: 20),
            onPressed: () => notifier.logout(),
          )
        ],
      ),
      body: Column(
        children: [
          // ==== 1. 상단 내 보유 자산 요약 (Glassmorphism 적용) ====
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF0A1020).withOpacity(0.8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text('보유 자산 현황', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                // 자산을 2열로 나열
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildBalanceItem('KRW', state.balances['KRW'] ?? 0, qtyFormat),
                    _buildBalanceItem('USD', state.balances['USD'] ?? 0, qtyFormat),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildBalanceItem('BTC', state.balances['BTC'] ?? 0, qtyFormat),
                    _buildBalanceItem('ADA', state.balances['ADA'] ?? 0, qtyFormat),
                  ],
                ),
              ],
            ),
          ),

          // ==== 2. 거래 가능 마켓 리스트 라벨 ====
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('거래 가능 마켓', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ),

          // ==== 3. 거래 가능 마켓 카드 리스트 ====
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: markets.length,
              itemBuilder: (context, index) {
                final market = markets[index];
                final symbol = market['symbol'] as String;
                final name = market['name'] as String;
                final iconColor = market['color'] as Color;
                final icon = market['icon'] as IconData;

                return GestureDetector(
                  onTap: () async {
                    // 마켓 클릭 시, 전역 상태의 심볼을 해당 마켓으로 갱신 후 상세 터미널 화면으로 네비게이션
                    await notifier.setActiveSymbol(symbol);
                    if (!context.mounted) return;
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const TradingTerminalScreen(),
                      ),
                    );
                  },
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withOpacity(0.6),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.05)),
                    ),
                    child: Row(
                      children: [
                        // 코인 심볼 아이콘 뱃지
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: iconColor.withOpacity(0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(icon, color: iconColor, size: 24),
                        ),
                        const SizedBox(width: 16),
                        // 코인 심볼 및 이름
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(symbol, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(name, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                          ],
                        ),
                        const Spacer(),
                        const Icon(Icons.chevron_right_rounded, color: Colors.white24),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  /// 공통 잔고 아이템 렌더링용 위젯 헬퍼
  Widget _buildBalanceItem(String currency, double amount, NumberFormat format) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(currency, style: const TextStyle(color: Color(0xFF64748B), fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 2),
        Text(
          format.format(amount),
          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
        ),
      ],
    );
  }
}
