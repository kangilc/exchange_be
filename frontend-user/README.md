# JavaF 거래소 사용자단 웹 클라이언트 (frontend-user)

JavaF 고성능 매칭 엔진 및 실시간 게이트웨이 연동 React + TypeScript + Vite 기반 사용자 전용 웹 터미널.

## 🌟 주요 기능 및 설계

### 1. 비로그인 접근 및 실시간 시세 조회
- **로그인 프리 접속**: 서비스 진입 시 인증 절차 없이 즉시 메인 화면 진입 가능.
- **실시간 호가/체결 연동**: 바이너리 웹소켓 게이트웨이를 통해 60fps 속도로 전송되는 실시간 10단 호가 잔량, 시세 차트, 최근 체결 내역을 비로그인 상태에서도 정상적으로 구독 및 렌더링함.

### 2. 글로벌 로그인 모달 및 접근 제어
- **온디맨드 모달**: 비로그인 상태에서 인증이 필요한 비즈니스 로직 실행 시 글래스모피즘 로그인 모달을 호출함.
- **주문 가드**: 비로그인 상태의 주문 제출을 차단하고 로그인 모달을 노출함.
- **개인 정보 보호**:
  - `입출금 센터`, `투자내역 및 원장` 탭 진입 차단 및 로그인 유도.
  - 비로그인 시 보유 자산 잔고 노출을 차단하고 `"로그인 필요"` 문구로 대체함.

### 3. 고성능 인메모리 스토어 (Zustand)
- [useExchangeStore.ts](src/store/useExchangeStore.ts)를 통해 실시간 호가/체결, RTT, TPS, 세션 정보 및 로그인 모달 상태를 반응형으로 전역 관리함.

### 4. 컴포넌트 모듈화 및 최적화
- **독립 컴포넌트 분리**: 비대한 `TradingTerminal.tsx` 코드를 기능별 독립 컴포넌트로 구조화함.
  - **[OrderBook.tsx](src/components/OrderBook.tsx)**: 10단 호가 렌더링 및 네온 플래시 이펙트(`OrderBookRow`) 격리.
  - **[OrderConsole.tsx](src/components/OrderConsole.tsx)**: 매수/매도 주문 입력 및 지정가/시장가/예약주문 폼 격리.
  - **[CustodyCenter.tsx](src/components/CustodyCenter.tsx)**: 입출금 신청 인터페이스 및 원장 내역 격리.
  - **[InvestmentHistory.tsx](src/components/InvestmentHistory.tsx)**: 포트폴리오 요약, 보유 현황 및 미체결 예약 주문 목록 격리.
- **불필요한 403 Forbidden 방지**: 비로그인 상태에서 자산 조회 API가 호출되지 않도록 `loadUserData`에 인증 필터 가드를 적용함.

### 5. 초저지연(Low-Latency) 렌더링 및 차트 튜닝
- **리렌더링 병목 차단**: 상위 컴포넌트의 잦은 렌더링 전파를 방지하기 위해 `OrderBook`과 **[RecentTradesList.tsx](src/components/RecentTradesList.tsx)**가 상태 스토어를 각자 구독하도록 위임함.
- **단발성 최신 상태 조회**: 주문 제출 등 실시간 변경 감시가 필요 없는 연산에는 `useExchangeStore.getState()`를 적용해 렌더링 유발을 방지함.
- **ResizeObserver 부모 감시**: 차트(`TradingViewChart.tsx`) 리사이즈 시 캔버스 축소 방해로 인한 크기 뭉개짐과 무한 루프 에러를 막기 위해, 차트 컨테이너의 부모 엘리먼트(`parentElement`)를 감시하도록 우회함.
- **5:2 화면 비율**: 가로 너비에 맞춰 5:2 고정 비율로 부드럽게 크기가 늘어나고 줄어들게 구현함.

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
```bash
# 프론트엔드 컨테이너 빌드 검증 및 재시작
docker compose up -d --build frontend-user
```
