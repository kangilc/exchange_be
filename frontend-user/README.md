# JavaF 거래소 사용자단 웹 클라이언트 (frontend-user)

JavaF 고성능 매칭 엔진과 실시간 게이트웨이에 연동하여 거래 서비스를 이용할 수 있는 React + TypeScript + Vite 기반의 사용자 전용 웹 터미널입니다.

## 🌟 주요 기능 및 설계

### 1. 비로그인 접근 및 실시간 시세 조회
- **로그인 프리 접속**: 서비스 진입 시 인증 절차 없이 즉시 메인 화면으로 진입할 수 있습니다.
- **실시간 호가 및 체결 연동**: 바이너리 웹소켓 게이트웨이를 통해 60fps 속도로 전송되는 실시간 10단 호가 잔량 및 시세 차트, 최근 체결 내역을 비로그인 상태에서도 정상적으로 구독하고 렌더링합니다.

### 2. 글로벌 로그인 모달 및 모듈 접근 제어
- **온디맨드 모달 팝업**: 비로그인 상태에서 헤더의 "로그인" 버튼을 클릭하거나, 인증이 요구되는 핵심 비즈니스 로직 실행 시 세련된 글래스모피즘 오버레이 모달이 나타납니다.
- **거래 권한 제한 (주문 가드)**: 비로그인 상태에서 매도/매수 주문 제출 시 주문 전송이 차단되며 로그인 안내 알림과 함께 모달 로그인 창이 표시됩니다.
- **개인 탭 보호 (인증 가드)**:
  - `입출금 센터` 탭 및 자산 요약의 입출금 바로가기 버튼 차단 및 로그인 유도
  - `투자내역 및 원장` 탭 진입 차단 및 로그인 유도
  - 비로그인 상태일 경우, 보유 자산 잔고 정보 영역을 노출하지 않고 `"로그인 필요"` 문구로 대체 처리

### 3. 고성능 인메모리 스토어 (Zustand)
- [useExchangeStore.ts](src/store/useExchangeStore.ts) 전역 스토어를 통해 실시간 오더북/체결 상태, RTT Latency, TPS 및 **로그인 세션 정보와 전역 로그인 모달 활성화 상태**를 반응형으로 중앙 집중식 관리합니다.

### 4. 컴포넌트 모듈화 리팩토링 및 안정성 조치 (🌟 신규)
- **비대형 단일 컴포넌트 해소**: 기존 1,370여 라인 규모의 `TradingTerminal.tsx` 코드를 가독성 및 재사용성을 향상하기 위해 기능별 독자 컴포넌트로 구조화하여 분리 리팩토링을 집행했습니다:
  - **[OrderBook.tsx](src/components/OrderBook.tsx)**: 10단 호가 및 잔량 렌더링, 네온 깜빡임 이펙트(`OrderBookRow`) 캡슐화.
  - **[OrderConsole.tsx](src/components/OrderConsole.tsx)**: 매수/매도 주문 입력 폼 및 타입 선택(LIMIT/MARKET/STOP) 캡슐화.
  - **[CustodyCenter.tsx](src/components/CustodyCenter.tsx)**: 입출금 신청 인터페이스, 가상계좌 주소 정보 제공 및 원장 입출금 내역 캡슐화.
  - **[InvestmentHistory.tsx](src/components/InvestmentHistory.tsx)**: 포트폴리오 자산 평가 요약 리포트, 코인별 보유 현황 원장 및 미체결 감시 예약 주문 대기열 캡슐화.
- **불필요한 403 Forbidden 차단**: 로그인하지 않은 상태에서 잔고 및 자산 정보를 동기화하는 API 호출이 자동 트리거되지 않도록 `loadUserData`에 비인가 보호 가드 조건(`!isAuthenticated`)을 추가하였습니다.
- **모바일/반응형 차트 미출력 대응**: 모바일 탭 변경 시 차트의 너비가 0으로 뭉개지거나 차트가 보이지 않는 레이아웃 결함을 방지하고자 `window.resize` 이벤트 대신 `ResizeObserver`를 탑재하여 화면 가시성 변동 시 크기가 즉각 동적 동기화되도록 수정했습니다.

### 5. 고저지연(Low-Latency) 렌더링 최적화 및 차트 레이아웃 튜닝 (🌟 신규)
- **초당 수십 회 WebSocket 통신 리렌더링 병목 차단**: 상위 컴포넌트 `TradingTerminal.tsx`에서 모든 실시간 상태를 구독하여 전체 대시보드가 리렌더링되던 HFT 고부하 병목 현상을 방지했습니다. 
  - 호가 데이터는 **[OrderBook.tsx](src/components/OrderBook.tsx)** 내부에서, 실시간 체결 로그는 신규 분리한 **[RecentTradesList.tsx](src/components/RecentTradesList.tsx)** 컴포넌트 내부에서만 각각 전담하여 개별적으로 Zustand 스토어를 구독하도록 위임했습니다.
  - 주문 실행 시의 가격 및 체결 정보 대조는 컴포넌트 리렌더링을 유발하지 않도록 `useExchangeStore.getState()` 구조의 1회성 상태 조회를 적용했습니다.
- **ResizeObserver 무한 루프 예방 및 5:2 화면 비율 고정**:
  - 차트 컴포넌트(`TradingViewChart.tsx`)에서 브라우저 크기를 급격히 줄이거나 탭을 전환할 때 내부 캔버스 크기로 인해 리사이즈가 차단되거나 브라우저 무한 루프 경고가 발생하던 현상을 막기 위해, 차트 부모 엘리먼트(`parentElement`)의 너비를 직접 감시하도록 `ResizeObserver` 경로를 우회 조정했습니다.
  - 고정 높이 대신 화면 너비에 반응하는 가변 비율(5:2) 설정을 통해 잘림 없는 미려한 레이아웃을 구현했습니다.


## 🛠️ 개발 및 빌드 환경

### 실행 및 빌드 명령어
```bash
# 의존성 패키지 설치
npm install

# 로컬 개발 서버 실행
npm run dev

# 프로덕션 빌드 컴파일
npm run build
```

### 도커(Docker) 기반 서비스 관리
해당 프로젝트는 루트 디렉토리의 `docker-compose.yml` 내에서 컨테이너화되어 관리됩니다.
```bash
# 프론트엔드 컨테이너 빌드 검증 및 재시작
docker compose up -d --build frontend-user
```
