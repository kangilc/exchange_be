import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/exchange_provider.dart';

/// 🔑 로그인 스크린 (JWT 토큰 인증 기반)
/// 
/// 앱의 첫 진입점 역할을 하며, 사용자 이메일과 비밀번호를 통해
/// 백엔드의 `/admin/auth/login` API와 통신하여 JWT 토큰을 발급받습니다.
/// 발급된 토큰은 ExchangeState 내부에 저장되어 통신 시 사용됩니다.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  // 이메일과 비밀번호 입력을 받기 위한 텍스트 컨트롤러 (기본 테스트 계정 세팅)
  final TextEditingController _emailController = TextEditingController(text: 'user1@exchange.com');
  final TextEditingController _passwordController = TextEditingController(text: 'password123');
  
  // 로그인 진행 중 스피너 표시 여부 제어
  bool _isLoading = false;
  
  // 로그인 실패 시 표시할 에러 메시지
  String _errorMessage = '';

  @override
  void dispose() {
    // 메모리 누수를 막기 위해 위젯이 파기될 때 컨트롤러도 해제합니다.
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// 로그인 버튼 클릭 시 호출되는 함수
  /// 이메일과 비밀번호 유효성을 검사하고 프로바이더를 통해 API 통신을 수행합니다.
  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    // 1. 빈 값 검증 로직
    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = '이메일과 비밀번호를 입력해주세요.';
      });
      return;
    }

    // 2. 로딩 상태 활성화 (버튼 비활성화)
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    // 3. 백엔드 로그인 API 호출 처리
    final notifier = ref.read(exchangeProvider.notifier);
    final result = await notifier.login(email, password);

    // 4. 위젯이 여전히 트리에 존재할 때만 UI 업데이트 (오류 방지)
    if (mounted) {
      setState(() {
        _isLoading = false;
        // 로그인 실패 시 에러 메시지 노출
        if (!result['success']) {
          _errorMessage = result['message'] ?? '로그인에 실패했습니다.';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // 전체 배경을 어두운 네온 그라데이션으로 처리하여 현대적인 룩 구현
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
                // 🌌 로고 애니메이션 데코레이션 스타일 (글래스모피즘 기반 빛 반사 효과)
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
                // 서비스 타이틀
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

                // ==== 이메일 입력 섹션 ====
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

                // ==== 비밀번호 입력 섹션 ====
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
                    obscureText: true, // 비밀번호 마스킹 처리
                    style: const TextStyle(fontSize: 13, color: Colors.white),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: '••••••••',
                      hintStyle: TextStyle(color: Colors.white30, fontSize: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // ==== 에러 메시지 노출부 ====
                if (_errorMessage.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(
                      _errorMessage,
                      style: const TextStyle(color: Color(0xFFEF4444), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                const SizedBox(height: 24),

                // ==== 로그인 실행 버튼 ====
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
