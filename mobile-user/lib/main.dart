import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers/exchange_provider.dart';
import 'screens/login_screen.dart';
import 'screens/market_list_screen.dart';

/// 🚀 JavaF Exchange 모바일 클라이언트 앱 엔트리포인트 (Main)
/// 
/// 앱을 시작하고 Riverpod 상태 관리 스코프(ProviderScope)를 초기화합니다.
/// 이 파일은 라우팅(인증 상태에 따른 화면 분기) 역할만 수행하며,
/// 세부 UI 컴포넌트들은 lib/screens 와 lib/widgets 디렉토리로 모듈화되었습니다.
void main() {
  runApp(
    // ProviderScope: Riverpod의 상태를 앱 전역에서 사용할 수 있게 해주는 최상위 위젯
    const ProviderScope(
      child: JavaFExchangeApp(),
    ),
  );
}

class JavaFExchangeApp extends ConsumerWidget {
  const JavaFExchangeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ExchangeProvider의 전역 상태를 구독하여 인증 상태(isAuthenticated)를 감지합니다.
    final state = ref.watch(exchangeProvider);

    return MaterialApp(
      title: 'JavaF Exchange',
      // 디버그 배너 숨김 처리
      debugShowCheckedModeBanner: false,
      // 앱 전체의 기본 테마를 다크 모드 기반 네온 스타일로 설정합니다.
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF070B15),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF8A2BE2), // 네온 퍼플
          secondary: Color(0xFF00F2FE), // 네온 시안
          surface: Color(0xFF0A1020),
        ),
        fontFamily: 'Inter', // 모던하고 가독성이 뛰어난 산세리프 폰트 기본 적용
      ),
      // 라우팅 분기 로직:
      // state.isAuthenticated 가 true 이면 마켓 목록 화면으로, 
      // false 이면 로그인 화면으로 자동 분기합니다.
      home: state.isAuthenticated ? const MarketListScreen() : const LoginScreen(),
    );
  }
}
