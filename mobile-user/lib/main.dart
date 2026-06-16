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
        // 기본 글씨 테마 설정
        primaryColor: const Color(0xFF8A2BE2),
      ),
      home: const AuthWrapper(),
    );
  }
}

/// 로그인 여부에 따라 적절한 스크린으로 이동시켜주는 래퍼 클래스
class AuthWrapper extends ConsumerWidget {
  const AuthWrapper({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(exchangeProvider);

    // 로그인된 사용자는 메인 하단 탭 내비게이션 셸 화면으로, 비로그인은 로그인 스크린으로 안내
    if (state.isAuthenticated) {
      return const MainShellScreen();
    } else {
      return const LoginScreen();
    }
  }
}

/// 🔑 로그인 스크린 (JWT 토큰 인증)
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final TextEditingController _emailController = TextEditingController(text: 'user1@example.com');
  final TextEditingController _passwordController = TextEditingController(text: 'password');
  bool _isLoading = false;
  String _errorMessage = '';

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = '이메일과 비밀번호를 입력해주세요.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final notifier = ref.read(exchangeProvider.notifier);
    final result = await notifier.login(email, password);

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (!result['success']) {
          _errorMessage = result['message'] ?? '로그인에 실패했습니다.';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0C101F), Color(0xFF070B15)],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 🌌 로고 애니메이션 데코레이션 스타일
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF8A2BE2).withOpacity(0.1),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00F2FE).withOpacity(0.05),
                          blurRadius: 30,
                          spreadRadius: 5,
                        ),
                      ],
                    ),
                    child: Container(
                      width: 60,
                      height: 60,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFF8A2BE2), Color(0xFF00F2FE)],
                        ),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet_rounded,
                        size: 32,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'JavaF Exchange',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.2,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '모바일에서 안전하고 빠른 자산 실시간 거래',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withOpacity(0.5),
                  ),
                ),
                const SizedBox(height: 36),

                // 이메일 입력
                const Text('이메일 주소', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                  ),
                  child: TextField(
                    controller: _emailController,
                    style: const TextStyle(fontSize: 13, color: Colors.white),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: 'email@example.com',
                      hintStyle: TextStyle(color: Colors.white30, fontSize: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // 비밀번호 입력
                const Text('비밀번호', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white.withOpacity(0.1)),
                  ),
                  child: TextField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(fontSize: 13, color: Colors.white),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: '••••••••',
                      hintStyle: TextStyle(color: Colors.white30, fontSize: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // 에러 메시지
                if (_errorMessage.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      _errorMessage,
                      style: const TextStyle(color: Color(0xFFEF4444), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                const SizedBox(height: 24),

                // 로그인 버튼
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF8A2BE2),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 5,
                    shadowColor: const Color(0xFF8A2BE2).withOpacity(0.4),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('로그인', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 📱 하단 탭 내비게이션 메인 셸 스크린
class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _currentIndex = 0;

  final List<Widget> _pages = [
    const TradingTerminalPage(), // 1. 거래소 탭
    const AssetsPage(),          // 2. 자산현황 탭
    const ProfilePage(),         // 3. 마이페이지 탭
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white10, width: 0.8)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          backgroundColor: const Color(0xFF0A1020),
          selectedItemColor: const Color(0xFF00F2FE),
          unselectedItemColor: const Color(0xFF64748B),
          selectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          iconSize: 20,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.swap_horiz_rounded),
              label: '거래소',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.wallet_rounded),
              label: '자산 현황',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              label: '마이 페이지',
            ),
          ],
        ),
      ),
    );
  }
}

/// 📊 1. 거래소 메인 터미널 페이지 (오더북 + 주문 패널 + 체결)
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

  // 실시간 수량 감지 깜빡임 보관용
  final Map<double, int> _prevQuantities = {};
  final Map<double, DateTime> _flashTimes = {};

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

    // 활성 심볼 변경 감지 시 기본 입력값 초기화
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

    // 변경된 수량 깜빡임 플래시 계산
    state.asks.forEach((priceCents, qty) {
      final double price = priceCents / 100.0;
      if (_prevQuantities.containsKey(price) && _prevQuantities[price] != qty) {
        _flashTimes[price] = DateTime.now();
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted) setState(() {});
        });
      }
      _prevQuantities[price] = qty;
    });

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

    final priceFormat = NumberFormat.decimalPattern();
    final qtyFormat = NumberFormat('#,##0.####');

    // 오더북 막대 배경용 최대 수량
    int maxQty = 1;
    for (var qty in state.bids.values) {
      maxQty = max(maxQty, qty);
    }
    for (var qty in state.asks.values) {
      maxQty = max(maxQty, qty);
    }

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
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
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
          // 웹소켓 연결 상태 뱃지
          Container(
            margin: const EdgeInsets.only(right: 16),
            alignment: Alignment.center,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: state.wsConnected ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    state.wsConnected ? 'LIVE' : 'DOWN',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                      color: state.wsConnected ? const Color(0xFF10B981) : const Color(0xFFEF4444),
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
            // 🌌 1. 상단 심볼 셀렉터 탭
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
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        '현재가',
                        style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8)),
                      ),
                      Text(
                        state.lastPrice > 0 ? '${priceFormat.format(state.lastPrice)} $fiat' : '계측 중...',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF00F2FE),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // 2. 메인 오더북 및 주문 분할 레이아웃
            Expanded(
              child: Row(
                children: [
                  // 좌측: 오더북 (10단)
                  Expanded(
                    flex: 6,
                    child: Container(
                      decoration: const BoxDecoration(
                        border: Border(right: BorderSide(color: Colors.white10)),
                      ),
                      child: Column(
                        children: [
                          // 오더북 컬럼 헤더
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                            color: Colors.white.withOpacity(0.02),
                            child: Row(
                              children: [
                                Expanded(
                                  flex: 3,
                                  child: Text('가격 ($fiat)', style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
                                ),
                                Expanded(
                                  flex: 3,
                                  child: Text('수량 ($coin)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
                                ),
                                Expanded(
                                  flex: 4,
                                  child: Text('누적 ($coin)', textAlign: TextAlign.right, style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
                                ),
                              ],
                            ),
                          ),

                          // 매도 호가 (Asks)
                          Expanded(
                            child: ListView(
                              reverse: true,
                              physics: const ClampingScrollPhysics(),
                              children: () {
                                final entries = state.asks.entries.toList();
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
                                    isAsk: true,
                                    barWidthPercent: barWidthPercent,
                                    priceFormat: priceFormat,
                                  );
                                });
                              }(),
                            ),
                          ),

                          // 스프레드 미드 프라이스
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.4),
                              border: const Border.symmetric(horizontal: BorderSide(color: Colors.white10)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  '스프레드',
                                  style: TextStyle(fontSize: 8, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                                ),
                                Text(
                                  '${priceFormat.format(state.spread)} $fiat',
                                  style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF00F2FE), fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),

                          // 매수 호가 (Bids)
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
                    ),
                  ),

                  // 우측: 주문 콘솔 패널 & 최근 체결 히스토리
                  Expanded(
                    flex: 5,
                    child: Column(
                      children: [
                        // 주문 제출 폼 박스
                        Container(
                          padding: const EdgeInsets.all(8.0),
                          decoration: const BoxDecoration(
                            border: Border(bottom: BorderSide(color: Colors.white10)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // 매수 / 매도 탭 버튼
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
                                          border: Border.all(color: _isBuy ? const Color(0xFF10B981) : Colors.transparent),
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
                                          border: Border.all(color: !_isBuy ? const Color(0xFFEF4444) : Colors.transparent),
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

                              // 금액 & 수량 입력 텍스트필드
                              _buildTextField(
                                controller: _priceController,
                                label: '주문 가격',
                                suffix: fiat,
                                enabled: _isLimit,
                              ),
                              _buildTextField(
                                controller: _qtyController,
                                label: '주문 수량',
                                suffix: coin,
                              ),
                              const SizedBox(height: 6),

                              // 사용자 가용 잔고 정보
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

                              // 예상 총액
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

                              // 전송 및 처리 버튼
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
                                      const SnackBar(content: Text('주문 실패: 잔고가 부족하거나 통신 상태를 확인해주세요.')),
                                    );
                                  }
                                },
                                child: Text(
                                  _isBuy ? '매수 (BUY)' : '매도 (SELL)',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ),

                        // 체결강도 디스플레이
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.01),
                            border: const Border(bottom: BorderSide(color: Colors.white10)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('체결강도', style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
                              Text(
                                '${state.volumePower.toStringAsFixed(1)}%',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFC084FC)),
                              ),
                            ],
                          ),
                        ),

                        // 최근 체결 로그 목록
                        Expanded(
                          child: state.tradesLog.isEmpty
                              ? const Center(
                                  child: Text(
                                    '체결 데이터 대기 중...',
                                    style: TextStyle(fontSize: 9, color: Color(0xFF64748B)),
                                  ),
                                )
                              : ListView.builder(
                                  itemCount: state.tradesLog.length,
                                  itemBuilder: (context, index) {
                                    final log = state.tradesLog[index];
                                    final String timeStr = DateFormat('HH:mm:ss').format(log.executedAt);
                                    final bool isBuy = log.side == 'BUY';
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            timeStr,
                                            style: const TextStyle(fontSize: 9, color: Color(0xFF64748B), fontFamily: 'monospace'),
                                          ),
                                          Text(
                                            priceFormat.format(log.price),
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: isBuy ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                            ),
                                          ),
                                          Text(
                                            qtyFormat.format(log.qty),
                                            style: const TextStyle(fontSize: 9, color: Color(0xFFCBD5E1), fontFamily: 'monospace'),
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

  /// 심볼 전환 탭 버튼 렌더러
  Widget _buildSymbolTabButton({
    required bool active,
    required String title,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF8A2BE2) : Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: active ? Colors.transparent : Colors.white10),
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: active ? Colors.white : const Color(0xFFCBD5E1),
          ),
        ),
      ),
    );
  }

  /// 개별 호가 데이터 행 렌더러
  Widget _buildOrderbookRow({
    required double price,
    required int qty,
    required int cumQty,
    required bool isAsk,
    required double barWidthPercent,
    required NumberFormat priceFormat,
  }) {
    final color = isAsk ? const Color(0xFFEF4444) : const Color(0xFF10B981);
    final bool isFlashing = DateTime.now().difference(_flashTimes[price] ?? DateTime.fromMillisecondsSinceEpoch(0)) < const Duration(milliseconds: 400);

    final bgColor = isAsk
        ? (isFlashing ? const Color(0xFFEF4444).withOpacity(0.4) : const Color(0xFFEF4444).withOpacity(0.12))
        : (isFlashing ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFF10B981).withOpacity(0.12));

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
              // 잔량 막대 그래프
              Container(
                width: currentBarWidth,
                height: 24,
                color: bgColor,
              ),
              // 실데이터
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(
                  children: [
                    // 가격 (30%)
                    Expanded(
                      flex: 3,
                      child: Text(
                        priceFormat.format(price),
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace', color: color),
                      ),
                    ),
                    // 수량 (30%)
                    Expanded(
                      flex: 3,
                      child: Text(
                        qty.toString(),
                        textAlign: TextAlign.right,
                        style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: Colors.white70),
                      ),
                    ),
                    // 누적 (40%)
                    Expanded(
                      flex: 4,
                      child: Text(
                        cumQty.toString(),
                        textAlign: TextAlign.right,
                        style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: Color(0xFF64748B)),
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

/// 💰 2. 자산 현황 (Assets / Wallet) 페이지
class AssetsPage extends ConsumerWidget {
  const AssetsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(exchangeProvider);
    final numberFormat = NumberFormat.decimalPattern();

    // 임의의 코인 시세 기준으로 총 자산 가치(KRW/USD) 계산
    final double btcPrice = state.activeSymbol == 'BTC-USD' ? state.lastPrice : 65000.0;
    final double btcBal = state.balances['BTC'] ?? 0.0;
    final double adaBal = state.balances['ADA'] ?? 0.0;
    final double krwBal = state.balances['KRW'] ?? 0.0;
    final double usdBal = state.balances['USD'] ?? 0.0;
    final double jafBal = state.balances['JAF'] ?? 0.0;

    // 총 가치 합산 (USD 기준 예시)
    final double totalEstimatedUSD = usdBal + (btcBal * btcPrice) + (adaBal * 0.45) + jafBal;

    return Scaffold(
      appBar: AppBar(
        title: const Text('보유 자산 현황', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0A1020),
        elevation: 0,
      ),
      body: Container(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 🌌 총 자산 요약 카드 (Glassmorphism + Neon shadow)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E1B4B), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: const Color(0xFF8A2BE2).withOpacity(0.3)),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8A2BE2).withOpacity(0.15),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '총 추정 자산',
                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '\$ ${numberFormat.format(totalEstimatedUSD)} USD',
                    style: const TextStyle(color: Color(0xFF00F2FE), fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '≈ ${numberFormat.format((totalEstimatedUSD * 1350).round())} KRW',
                    style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4.0, vertical: 8.0),
              child: Text(
                '보유 자산 목록',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),

            // 자산 리스트 영역
            Expanded(
              child: ListView(
                children: [
                  _buildAssetItemRow(name: 'Bitcoin', symbol: 'BTC', balance: btcBal, formattedValue: '\$ ${numberFormat.format(btcBal * btcPrice)}'),
                  _buildAssetItemRow(name: 'Cardano', symbol: 'ADA', balance: adaBal, formattedValue: '₩ ${numberFormat.format((adaBal * 600).round())}'),
                  _buildAssetItemRow(name: 'US Dollar', symbol: 'USD', balance: usdBal, formattedValue: '\$ ${numberFormat.format(usdBal)}'),
                  _buildAssetItemRow(name: 'Korean Won', symbol: 'KRW', balance: krwBal, formattedValue: '₩ ${numberFormat.format(krwBal)}'),
                  _buildAssetItemRow(name: 'JavaF Token', symbol: 'JAF', balance: jafBal, formattedValue: '\$ ${numberFormat.format(jafBal)}'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssetItemRow({
    required String name,
    required String symbol,
    required double balance,
    required String formattedValue,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: const Color(0xFF8A2BE2).withOpacity(0.15),
                child: Text(
                  symbol[0],
                  style: const TextStyle(color: Color(0xFF00F2FE), fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(symbol, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10)),
                ],
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                balance.toStringAsFixed(4),
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
              ),
              const SizedBox(height: 2),
              Text(
                formattedValue,
                style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// 👤 3. 마이 페이지 (My Page / Profile)
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(exchangeProvider);
    final notifier = ref.read(exchangeProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('마이 페이지', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0A1020),
        elevation: 0,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 프로필 정보 요약 카드
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withOpacity(0.08)),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: const Color(0xFF8A2BE2).withOpacity(0.2),
                    child: const Icon(Icons.person_rounded, size: 28, color: Color(0xFF00F2FE)),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          state.authEmail.isNotEmpty ? state.authEmail : '사용자',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '회원 고유 식별번호 (UID) : ${state.authUserId}',
                          style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            const Text('보안 및 인증 정보', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white70)),
            const SizedBox(height: 8),

            _buildInfoTile('로그인 세션 토큰', '활성화됨 (JWT)'),
            _buildInfoTile('접근 레벨', '사용자 등급(USER)'),
            const Spacer(),

            // 로그아웃 버튼
            ElevatedButton(
              onPressed: () async {
                await notifier.logout();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('안전하게 로그아웃되었습니다.')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444).withOpacity(0.1),
                foregroundColor: const Color(0xFFEF4444),
                side: const BorderSide(color: Color(0xFFEF4444), width: 0.8),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                elevation: 0,
              ),
              child: const Text('로그아웃', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoTile(String label, String value) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withOpacity(0.5),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
