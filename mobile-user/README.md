# JavaF 거래소 모바일 사용자단 (mobile-user)

JavaF 고성능 매칭 엔진과 실시간 웹소켓 게이트웨이에 연동하여 거래 서비스를 모바일 앱 환경에서 이용할 수 있도록 구축한 Flutter 기반의 크로스 플랫폼 클라이언트입니다.

## 🌟 주요 기능 및 설계

### 1. 실시간 32바이트 바이너리 패킷 파싱
- 게이트웨이에서 60fps 속도로 전송되는 바이너리 스트림 데이터를 고속 언팩합니다.
- [binary_parser.dart](lib/utils/binary_parser.dart)에서 Dart의 `ByteData`를 활용하여 빅 엔디안(Big Endian) 포맷의 32바이트 바이너리를 파싱하여 메모리 점유를 최적화했습니다.

### 2. Riverpod 상태 관리 및 웹소켓 연동
- [exchange_provider.dart](lib/providers/exchange_provider.dart)를 통해 실시간 호가 정보, 체결 히스토리, 웹소켓 연결 상태를 반응형으로 보관 및 처리합니다.
- 최초 앱 실행 시 각 심볼별 호가 스냅샷 API(`http://10.0.2.2:9100/snapshot` 등)를 호출하여 기본 데이터를 안전하게 싱크한 뒤 실시간 웹소켓 이벤트 델타를 누적 반영합니다.
- 실시간 수신된 체결 이력을 기반으로 **체결강도(Volume Power)** 수치를 매 프레임별로 동적 연산합니다.

### 3. 모바일 다크 모드 터미널 UI
- [main.dart](lib/main.dart)에 거래소 전용 세련된 다크 테마를 기반으로 모바일 화면을 구성했습니다.
- **실시간 호가창**: 호가별 거래 잔량의 크기에 비례하여 가로 막대 그래프(Volume Bar Overlay)가 뒷배경에 다이내믹하게 채워집니다.
- **체결 로그 리스트**: 매수(초록색), 매도(빨간색) 체결 상태를 직관적으로 표현하여 실시간 시세 흐름을 빠르게 확인할 수 있습니다.

## 🛠️ 개발 및 빌드 가이드

### 실행 전제 조건
- 로컬 PC에 **Flutter SDK 3.22.x** 이상 및 Android/iOS 네이티브 빌드 도구 설치 필요.
- 실기기 또는 에뮬레이터(Android Emulator, iOS Simulator) 구동.

### 실행 명령어 (윈도우 터미널 / VS Code 실행 권장)
```bash
# 1. 의존성 패키지 설치
flutter pub get

# 2. 로컬 코드 정적 분석 검사
flutter analyze

# 3. 디바이스 빌드 및 실행
flutter run
```
