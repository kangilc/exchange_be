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

### 4. JWT 기반 사용자 인증 및 세션 연동
- **인증 분기**: 최초 기동 시 `AuthWrapper`가 사용자 세션을 체크하여 로그인 화면 또는 메인 터미널 셸로 라우팅을 수행합니다.
- **로그인 시스템**: `/admin/auth/login` 및 `/admin/auth/logout` API를 연동하여 JWT Access/Refresh 토큰 획득 및 무효화를 처리합니다.
- **동적 자산 연동**: 로그인된 이메일을 기반으로 `/admin/users`를 조회하여 사용자 고유 UID(`userId`)를 식별합니다. 이후 해당 사용자 고유의 지갑 정보(`/admin/wallets/user/{userId}`)를 가져오고 주문 접수 시 해당 UID의 자산을 가감 처리합니다.

### 5. 프리미엄 내비게이션 & UI
- **하단 탭 내비게이션 (BottomNavigationBar)**: 모바일 전용의 3단 탭 인터페이스를 제공합니다:
  - **거래소 (Exchange)**: 고성능 실시간 호가 및 체결 내역 확인, 모의 투자 주문 콘솔.
  - **자산 현황 (Assets)**: 전체 보유 자산을 USD/KRW로 실시간 자동 환산 계산 및 개별 토큰(BTC, ADA, USD, KRW, JAF) 잔고를 표시하는 고급형 지갑 카드 레이아웃.
  - **마이 페이지 (My Page)**: 로그인 세션 및 JWT 상태 확인, 사용자 정보 열람 및 안전한 로그아웃 프로세스.

---

## 🛠️ 개발 및 빌드 가이드

터미널 환경에 맞춰 아래 가이드를 선택하여 실행해 주세요.

> [!NOTE]
> **백엔드 접속 IP 자동 감지 및 설정**:
> - **로컬 환경 실행 (기본값)**: 별도의 주소 옵션 없이 빌드/실행 시, 기기 플랫폼에 맞춰 로컬 백엔드 서버에 자동으로 연결됩니다. (리눅스/윈도우 데스크톱 및 웹: `127.0.0.1` / 안드로이드 에뮬레이터: `10.0.2.2`)
> - **외부 백엔드 서버 연동**: 원격 서버나 다른 특정 호스트 IP에 연결하려는 경우에만 실행 시 `--dart-define=API_HOST=<호스트_IP>` 옵션을 사용해 주세요.

### 🐧 1. WSL (Linux) 환경 가이드
WSL 환경에서는 리눅스 전용으로 빌드된 Flutter SDK를 사용합니다.

#### 환경 변수(PATH) 설정 (권장)
매번 절대 경로를 입력하지 않으려면 아래 명령어를 실행하여 `flutter` 명령을 전역 등록해 줍니다.
```bash
# 1. PATH 등록
echo 'export PATH="$PATH:/home/administrator/sdk/flutter/bin"' >> ~/.bashrc
# 2. 터미널 반영
source ~/.bashrc
```

#### 명령 실행 (PATH가 안 잡혀 있어 절대 경로를 써야 하는 경우)
* **패키지 설치**: `/home/administrator/sdk/flutter/bin/flutter pub get`
* **코드 정적 검사**: `/home/administrator/sdk/flutter/bin/flutter analyze`
* **위젯 단위 테스트**: `/home/administrator/sdk/flutter/bin/flutter test`
* **앱 실행(개발/디버그 모드)**: `/home/administrator/sdk/flutter/bin/flutter run`
  *(외부 백엔드 호스트 IP 지정 시)*: `/home/administrator/sdk/flutter/bin/flutter run --dart-define=API_HOST=<호스트_IP>`

* **PC 화면 구동 (리눅스 데스크톱 창)**: 
  최초 1회 리눅스 빌드 활성화를 위해 플랫폼 폴더를 생성합니다.
  ```bash
  /home/administrator/sdk/flutter/bin/flutter create --platforms=linux --project-name=mobile_user .
  ```
  이후 아래 명령어로 실행할 수 있습니다.
  ```bash
  /home/administrator/sdk/flutter/bin/flutter run -d linux
  ```
  *(외부 백엔드 호스트 IP 지정 시)*:
  ```bash
  /home/administrator/sdk/flutter/bin/flutter run -d linux --dart-define=API_HOST=<호스트_IP>
  ```
  *(단, 아래 리눅스 빌드 도구 사전 설치 필요)*:
  ```bash
  sudo apt update && sudo apt install -y clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev
  ```

---

### 💻 2. Windows (호스트 PC) 환경 가이드
윈도우 명령 프롬프트(CMD) 또는 PowerShell 환경에서는 개발자 컴퓨터의 로컬 환경 변수에 잡혀있는 윈도우용 Flutter SDK(`F:\flutter\bin\flutter`)를 활용합니다.

#### 실행 전제 조건
- 모바일 가상 기기(에뮬레이터)가 켜져 있거나 크롬 브라우저, 혹은 윈도우 PC 빌드가 활성화되어 있어야 합니다.

#### 명령 실행 (윈도우 터미널)
* **패키지 설치**: 
  ```cmd
  cd /d F:\exchange_be\mobile-user
  flutter pub get
  ```
* **연결된 디바이스 목록 확인 (PC 화면 장치 포함)**: 
  ```cmd
  flutter devices
  ```
* **모바일 기기에서 앱 실행**: 
  ```cmd
  flutter run
  ```
* **PC 화면 구동 (Windows 데스크톱 독립 창)**: 
  ```cmd
  flutter run -d windows
  ```
* **PC 화면 구동 (Chrome 브라우저 창)**: 
  ```cmd
  flutter run -d chrome
  ```
