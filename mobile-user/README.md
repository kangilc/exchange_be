# Mobile User Client (Flutter)

JavaF Exchange의 모바일 트레이딩 클라이언트 앱입니다. Flutter와 Riverpod 상태 관리자를 기반으로 구축되었으며, 웹 기반의 `frontend-user`와 동일한 **Glassmorphism(유리 질감)** 및 **네온 컬러** 기반의 디자인 시스템을 채택하고 있습니다.

## 🚀 아키텍처 개요

1,300줄 이상의 단일 파일(Monolithic) 구조에서 벗어나 완벽한 모듈화 및 탭 기반(Tab-based) 아키텍처로 리팩토링되었습니다. 메인 스레드 블로킹을 방지하기 위해 WebSocket 메시징과 UI 렌더링 주기를 분리(Throttling)하는 고성능 구조를 갖추고 있습니다.

### 📁 디렉토리 구조

```text
mobile-user/
├── lib/
│   ├── main.dart                      // 앱 부트스트래핑 및 라우팅 (Entrypoint)
│   ├── providers/
│   │   └── exchange_provider.dart     // Riverpod 전역 상태, WebSocket 통신, JWT RTR 관리, 30ms 렌더링 스로틀링
│   ├── screens/                       // 주요 화면(Page/Screen) 위젯
│   │   ├── login_screen.dart          // JWT 인증 로그인 뷰
│   │   ├── market_list_screen.dart    // 첫 진입 시 노출되는 거래 가능 마켓 카드 리스트 뷰
│   │   └── trading_terminal_screen.dart // 4개 탭(주문/호가/차트/체결)을 호스팅하는 거래소 메인 화면
│   └── widgets/                       // 터미널 화면 내 재사용 가능한 탭(Tab) 위젯
│       ├── order_console_widget.dart  // 매수/매도 주문 입력 폼 (지정가, 시장가)
│       ├── order_book_widget.dart     // 실시간 10단 매수/매도 호가창 (플래시 애니메이션 및 누적 바 포함)
│       ├── chart_placeholder_widget.dart // 네이티브 차트 적용 전 임시 뷰
│       └── recent_trades_widget.dart  // 매칭엔진 실시간 체결 로그 리스트
```

## ✨ 주요 기능 및 특징

1. **Glassmorphism UI**: 다크 네이비 배경(`Color(0xFF070B15)`) 위에 약간의 투명도가 들어간 흰색 박스를 오버레이하여 유려하고 모던한 감각을 극대화했습니다.
2. **반응형 탭 네비게이션**: 한 화면에 데이터를 우겨넣지 않고 모바일 사용성을 위해 **주문 ➔ 호가 ➔ 차트 ➔ 체결** 순의 하단(또는 상단) 탭으로 뷰를 깔끔하게 분리했습니다.
3. **고성능 호가 렌더링 (30ms Throttling)**: `exchange_provider` 내부에 30ms 단위의 Timer 틱을 두어, 초당 수천 건 들어오는 WebSocket 바이너리 이벤트를 백그라운드 큐에 쌓고 UI는 오직 초당 약 30회(30 FPS)만 리빌드되도록 하여 버벅임(Jank)을 원천 차단했습니다.
4. **JWT & RTR 인증 자동화**: Dio Interceptor를 통해 액세스 토큰 만료 시 리프레시 토큰을 통해 백그라운드에서 자동 재발급(Rotation)을 수행합니다.
5. **Ping/Pong 지연시간 모니터링**: WebSocket Latency를 실시간으로 측정하고 TPS(초당 메시지 처리량)를 추적하여 백그라운드 서버 모니터링을 지원합니다.
6. **REJECT 응답 파싱**: 매칭 엔진에서 잔고 부족이나 잘못된 가격으로 인해 거절(REJECT) 이벤트가 발생할 경우, 상태를 구독하여 사용자 친화적인 스낵바로 에러 메시지를 자동 출력합니다.

## 🛠 실행 방법

```bash
# 패키지 의존성 설치
flutter pub get

# 앱 실행 (에뮬레이터 또는 실기기 연결 필요)
flutter run
```

> **Note**: 백엔드 API 및 WebSocket 서버(Admin API, Engine Core, Adapter 등)가 로컬호스트나 별도의 서버에서 구동 중이어야 정상적인 로그인 및 실시간 데이터 수신이 가능합니다.
