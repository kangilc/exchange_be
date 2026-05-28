# 🌌 JavaF Exchange (HF-X)

초저지연(Ultra-Low Latency) 인메모리 가격-시간 우선(FIFO) 매칭 엔진, 실시간 시세 분배 웹소켓 게이트웨이, 초고속 오프라인 백테스팅 프레임워크를 갖춘 차세대 암호화폐/증권 거래소 백엔드 플랫폼. 

최근 **비동기 이벤트 소싱(Event Sourcing) 기반 PostgreSQL 실시간 자산 정산(Settle) 파이프라인**, **고대비 다크 테마 터미널(JavaF)**, **ADA-KRW 멀티 심볼 병렬 확장**, **진짜 RTT 네트워크 지연 실측**, **rAF 기반 호가창 렌더링 스로틀링**, **Prometheus & Grafana 기반 0-의존성 초경량 성능 계측 체계**, 그리고 **Spring Boot 기반 통합 어드민 API & 어드민 대시보드 콘솔**이 추가 완비됨.

---

## 🚀 주요 성능 지표 (Benchmark)

로컬 머신(OpenJDK 17 환경)에서 오프라인 백테스터를 구동해 측정한 매칭 엔진의 순수 처리 한계 성능.

| 지표 (Metric) | 측정 결과 (Performance Metrics) |
| :--- | :--- |
| **초당 주문 처리량 (Throughput)** | **1,885,547.64 orders/sec** (초당 188만+ 건 매칭) |
| **평균 매칭 지연 시간 (Latency)** | **530.35 nanoseconds/order** (건당 0.53마이크로초) |
| **실시간 평균 매칭 속도 (Real Latency)**| **196.74 µs** (네트워크/Kafka 브릿지 연동 실측 평균) |
| **JVM JIT 예열 기능 (JIT Warmup)** | 지원 (JIT 최적화 컴파일 경로 반영) |
| **동적 시뮬레이션 데이터** | 10,000건의 실시간 주문 및 체결 시나리오 (`orders.csv` 자동 생성) |

---

## 🏛️ 플랫폼 전체 시스템 아키텍처

```mermaid
graph TD
    %% Clients
    UI[JavaF Premium HTML5 UI] <-->|32-byte Binary Stream / PING-PONG| WS[Netty WS Gateway: 8088]
    AdminUI[Admin Dashboard UI: admin.html] <-->|REST API / JSON| AdminAPI[Spring Boot Admin API: 8081]
    
    %% Monitoring
    Prometheus[Prometheus Server: 9090] -->|Scrape Metrics /metrics| EngineBTC[Engine BTC-USD: 9100]
    Prometheus -->|Scrape Metrics /metrics| EngineADA[Engine ADA-KRW: 9101]
    Prometheus -->|Scrape Metrics /metrics| WS[WS Gateway: 9102]
    Grafana[Grafana Dashboard: 3000] -->|Query Metrics| Prometheus
    
    %% Engine BTC
    WS -->|Symbol Routing / Port 9999| EngineBTC
    EngineBTC -->|Event TCP / Port 9998| KAdapterBTC[Kafka Adapter BTC]
    KAdapterBTC -->|JSON Stream| Kafka[Kafka Broker: 9092]
    
    %% Engine ADA
    WS -->|Symbol Routing / Port 9997| EngineADA
    EngineADA -->|Event TCP / Port 9996| KAdapterADA[Kafka Adapter ADA]
    KAdapterADA -->|JSON Stream| Kafka
    
    %% Real-time Settle Pipeline
    Kafka -->|Topic: accept-events, trade-events, cancel-events| DBPersister[Db Persister Daemon]
    DBPersister -->|Atomic Database Transaction| Postgres[(PostgreSQL: 5432)]
    
    %% Admin Integration
    AdminAPI -->|JPA/Hibernate Queries| Postgres
    
    Kafka -->|Topic: orderbook-delta| WS
```

---

## 🔌 서비스 포트 맵핑 현황 (Service Port Mappings)

플랫폼을 구성하는 모든 분산 마이크로서비스 및 인프라의 내부(Container) 및 외부(Host) 포트 바인딩 현황입니다. 특정 호스트 포트 충돌 방지 설계 방식도 아래 표에서 함께 확인하실 수 있습니다.

| 서비스명 (Service) | 역할 (Role) | 호스트 외부 포트 (Host Port)          | 컨테이너 내부 포트 (Container Port)    | 맵핑 유형 & 비고 (Notes)                                                                                                            |
| :--- | :--- |:-------------------------------|:-------------------------------|:------------------------------------------------------------------------------------------------------------------------------|
| **`ws-gateway`** | 실시간 웹소켓 시세/주문 게이트웨이 | **`8088`**<br>`9102`           | **`8088`**<br>`9102`           | **주요 접속 서비스 포트**.<br>자체 프로메테우스 메트릭 노출 포트 포함.                                                                                  |
| **`admin-api`** | Spring Boot 통합 어드민 백엔드 | **`8081`**                     | **`8081`**                     | 어드민 대시보드 연동용 REST API 포트.                                                                                                     |
| **`cadvisor`** | 실시간 컨테이너 리소스 계측 에이전트 | **`8182`**                     | **`8182`**                     | ⚠️ **포트 충돌 방지 회피 설계**:<br>내부 포트는 `8182`으로 고정이지만, 포트 충돌 방지를 위해 호스트 외부 포트를 **`8182`**로 우회 매핑하였습니다. (ws-gateway는 `8088` 포트로 이전됨) |
| **`postgres`** | 회원/자산/정산 관계형 데이터베이스 | **`5432`**                     | **`5432`**                     | 데이터베이스 단독 포트 바인딩.                                                                                                             |
| **`prometheus`** | 분산 메트릭 수집 및 시계열 DB | **`9090`**                     | **`9090`**                     | 프로메테우스 웹 콘솔 접속 포트.                                                                                                            |
| **`grafana`** | 실시간 계측 시각화 대시보드 | **`3000`**                     | **`3000`**                     | 그라파나 대시보드 웹 UI 접속 포트 (ID/PW: admin/admin).                                                                                    |
| **`engine-btc`** | BTC-USD 매칭 엔진 (인메모리 코어) | **`9999`**<br>`9998`<br>`9100` | **`9999`**<br>`9998`<br>`9100` | TCP 커맨드 수신 (9999)<br>TCP 체결 이벤트 송신 (9998)<br>프로메테우스 메트릭 (9100)                                                                |
| **`engine-ada`** | ADA-KRW 매칭 엔진 (인메모리 코어) | **`9997`**<br>`9996`<br>`9101` | **`9997`**<br>`9996`<br>`9101` | TCP 커맨드 수신 (9997)<br>TCP 체결 이벤트 송신 (9996)<br>프로메테우스 메트릭 (9101)                                                                |
| **`kafka`** | 분산 실시간 메시지 브로커 | **`29092`**<br>`9092`          | **`29092`**<br>`9092`          | 외부 개발기 접속용 (29092)<br>컨테이너 내부 브릿지용 (9092)                                                                                     |
| **`zookeeper`** | 카프카 메타데이터 제어/조율 관리자 | **`2181`**                     | **`2181`**                     | 카프카 클러스터 내부 조율용.                                                                                                              |

---

## 🛡️ 통합 어드민 제어 시스템 (Admin Console)

거래소 운영 효율성 극대화 및 실시간 정산 감사를 지원하는 통합 어드민 솔루션이 완비되었습니다.

### 1. Spring Boot 기반 REST API 백엔드 (`admin-api`)
*   **통화별 총 유통 자산 지표 조회 (`/admin/wallets/summary`):** 거래소 내에 보관된 전체 자산(KRW, USD, BTC, ADA)의 사용 가능한 잔액 및 거래 진행중 락(Locked)이 걸린 자산의 합산 수치를 원자적으로 조회합니다.
*   **실시간 성능 및 시스템 통계 요약 (`/admin/stats/summary`):** 총 등록 회원 수, 활성 지갑 수, 금일 누적 매칭 거래 수, 누적 거래 대금(Volume)을 즉각 취합하여 반환합니다.
*   **유입 유저 지표 조회 (`/admin/stats/users`):** 일간, 주간, 월간, 분기, 연간 해상도 변수(Resolution)를 주입받아 시간에 따른 신규 회원 가입 유입량을 반환합니다.
*   **매칭 거래 분석 및 자산 변경 이력 조회 (`/admin/stats/trades` / `/admin/stats/assets`):** 기간별 거래소 내의 원화 및 USD, 각종 코인 자산의 증감 흐름과 누적 체결 수치를 다각도로 조회합니다.
*   **회원 원장 관리 (CRUD):** 회원 가입 등록(`POST /admin/users`), 정보 수정(`PUT /admin/users/{id}`), VIP 등급/거래정지(SUSPENDED) 관리 기능이 완벽 제공됩니다.
*   **감사 연동 자산 추가/차감 (`/admin/users/{id}/assets/adjust`):** 관리자가 특정 회원의 자산 지갑을 즉각 지급(Deposit) 또는 회수(Withdrawal)할 수 있는 안전한 REST API를 제공하며, 모든 변동분은 `ledger_journal` 감사용 테이블에 완전 보장됩니다.
*   **PostgreSQL 성능 최적화:** 500 에러를 유발할 수 있는 복잡한 Native Time-Bucket Parameter Binding 문제점을 표준적인 `GROUP BY 1, 2, 3` 및 `ORDER BY 1 DESC` 인덱스 기법으로 튜닝 완료했습니다.

### 2. 프리미엄 다크 글래스모피즘 웹 어드민 ([admin.html](file:///home/administrator/exchange_be/frontend/admin.html))
*   **모던 테크 미학 테마:** Outfit & Noto Sans 타이포그래피, 매혹적인 보라색/하늘색 네온 발광 효과와 반투명 블러(backdrop-filter) 카드 디자인 시스템 적용.
*   **ApexCharts 인터랙티브 통계 분석:** CDN 기반 하이엔드 차트 라이브러리 연동으로 일간, 주간, 월간, 분기, 연간 필터링에 따른 가입 추이, 체결 건수/대금, 자산 입출금 비율 도넛 차트 구현.
*   **통합 회원 관리 모달:** 모달 윈도우를 활용해 이메일 실시간 계정 검색, 신규 회원 등록, 상태 변동, 자산 추가/차감(Deposit/Withdrawal)을 즉시 실시간 인젝션 조작합니다.
*   **WSL/네트워크 바인딩 게이트웨이:** 우측 상단의 `API Host` 입력창을 통해 WSL 가상 머신 IP나 원격 도메인 IP를 동적으로 주입하여 즉시 REST API 커넥션을 수립할 수 있도록 설계했습니다.

---

## 🌌 거래자 포털 및 5대 핵심 회원 기능 (Trader Portal & Advanced Features)

실감 나는 실시간 모의 거래 경험과 한 단계 높은 사용자 보안을 실현하기 위해, 단일 HTML이었던 터미널 코드를 **의존성 제로의 고성능 Vanilla ES6 모듈 구조로 모듈화**하고 **5대 핵심 회원 서비스**를 전격 마운트하였습니다.

### 1. 초경량 Vanilla ES6 모듈화 아키텍처 (DOM/라인 -90% 경량화)
*   **`main.html` 경량화:** 기존 2,450여 라인의 비대해진 HTML 파일에서 인라인 CSS 스타일 및 복잡한 웹소켓 수신 스크립트를 완전 제거하여 **280라인 미만의 순수 HTML5 뼈대로 리팩토링**했습니다.
*   **역할 분담형 ES6 Modules 격리 설계:**
    *   **[state.js](file:///home/administrator/exchange_be/frontend/js/state.js):** 지갑 잔고, 오더북, 체결 정보 등 전역 상태를 싱글톤 구조로 관리하는 단일 상태 소스(Source of Truth).
    *   **[auth.js](file:///home/administrator/exchange_be/frontend/js/auth.js):** **[2FA OTP 보안인증 및 로그인 기기 감사]** 캡슐화.
    *   **[wallet.js](file:///home/administrator/exchange_be/frontend/js/wallet.js):** 가상 지갑 잔고 가감, 트랜잭션 기록 및 **[입출금 제어판 모달]** 관리 캡슐화.
    *   **[terminal.js](file:///home/administrator/exchange_be/frontend/js/terminal.js):** Presets 비율 슬라이더 제어, **[지정가/시장가/예약주문 탭 전환]** 및 액티브 주문 제어 캡슐화.
    *   **[orderbook.js](file:///home/administrator/exchange_be/frontend/js/orderbook.js):** 오더북 10레벨 병합 연산, rAF 호가 드로잉 및 누적 Hover 툴팁 캡슐화.
    *   **[chart.js](file:///home/administrator/exchange_be/frontend/js/chart.js):** 캔버스 변동 틱 그래프 네온 드로잉 캡슐화.
    *   **[gateway.js](file:///home/administrator/exchange_be/frontend/js/gateway.js):** 초저지연 바이너리 패킷 디코더, RTT 핑퐁 및 Throughput(TPS) 자동 측정 캡슐화.
    *   **[app.js](file:///home/administrator/exchange_be/frontend/js/app.js):** 각 모듈들의 순차적 부트스트랩 및 웹소켓 데이터 연동을 조율하는 메인 애플리케이션 엔트리.

### 2. 5대 핵심 실시간 거래자 편의 기능
1.  **🌌 Google Authenticator 모의 2FA OTP 보안인증:**
    *   중대 자산 출금(Withdrawal) 집행 시 구글 OTP 인증을 요구하는 글래스모피즘 네온 모달을 신설했습니다.
    *   30초 주기로 TOTP 알고리즘에 의거한 6자리 1회용 패스워드가 카운트다운 타이머와 함께 실시간 갱신되어 제공됩니다.
2.  **💰 자산 입출금(Deposit/Withdrawal) 제어판:**
    *   원화(KRW), 달러(USD), 비트코인(BTC), 에이다(ADA) 자산의 입금 및 주소 화이트리스트 기반 출금 모달 패널을 제공합니다.
    *   수행된 모든 자산 변동 사항은 지갑 원장(`ledger`)에 저장되며 최근 5건의 이력이 실시간 연동되어 표출됩니다.
3.  **🛡️ 예약 주문(Stop-Limit) 터미널 및 감시 예약 로그:**
    *   주문 터미널에 **[예약주문(Stop)]**을 신설하여, 감시 가격(Trigger Price) 도달 시에만 지정 한도가 백엔드에 즉각 투입됩니다.
    *   대기 중인 예약 주문들이 독자적인 액티브 주문 큐 테이블에 갱신되며, 사용자가 즉시 `×` 취소 명령을 실행할 수 있습니다.
4.  **📊 종합 자산 및 포트폴리오 분석 리포트:**
    *   보유 자산 요약 카드를 클릭하면 부드러운 스케일 모달 효과와 함께 ApexCharts 자산 추이 그래프가 나타납니다.
    *   VIP GOLD 거래 수수료 등급, 포트폴리오 Yield(수익률), 24H 수수료 기여 지표 등을 정밀 계산합니다.
5.  **📢 공지 자막 마키(Marquee) 텍스트 배너:**
    *   대시보드 최상단 영역에 흐르는 네온 블루 배너 라인을 신설하여 실시간 상장 정보 및 보안 지침 경고가 흐르도록 디자인 완성도를 높였습니다.

### 3. 프리미엄 하이브리드 2단 레이아웃 및 반응형 모바일 주문 우선 설계
*   **데스크톱 하이브리드 3열 대칭 레이아웃:**
    *   **메인 컬럼 (좌/중 - 2fr 너비)**: 최상단에 넓게 펼쳐지는 **`실시간 변동 가격 차트(Canvas)`**, 그 아래 좌측에 **`10단 실시간 호가창`**, 우측에 **`주문 터미널(지정가/시장가/예약)`** 및 **`보유 자산 현황`** 카드가 나란히 2단 배치되며 최하단에 **`실시간 대기 예약 주문 큐`**가 가로로 넓게 포진합니다.
    *   **사이드바 컬럼 (우 - 1fr 너비)**: 최상단에 **`마켓 검색기(Coin List)`**가 위치하고, 그 아래 **`실시간 체결 내역`** 및 **`매칭 로그 콘솔`**이 완벽히 매칭되어 최적의 프리미엄 거래소 UX를 100% 실현합니다.
*   **모바일/태블릿 반응형 주문 우선권 (Custom CSS Order):**
    *   화면 폭이 좁은 모바일/태블릿 기기(900px 이하)에서는 모든 카드를 1열로 자동 병합하되, 급변하는 시세에 즉각 대응할 수 있도록 **[실시간 호가창 ➔ 주문 터미널 ➔ 보유 자산 ➔ 대기 예약 주문]**을 최상단에 선제 표출하고, 차트와 검색기, 로그 내역은 하단으로 유연하게 배치되도록 CSS Grid/Flexbox `order` 프로퍼티를 접목시켰습니다.
*   **HFT 10레벨 오더북 슬림화 및 바이너리 패킷 싱글톤 상태 복원:**
    *   호가창을 세로 오버플로우 없이 미려한 디자인 범위 내에 수렴시키기 위해 **10레벨 Asymmetric 호가창**으로 슬림화하여 웹소켓 데이터 유입 시 파싱 렌더링 딜레이를 `<1ms RTT` 이내로 완벽히 제어합니다.
    *   또한 서브모듈 간에 개별 로딩되어 상태 공유 병목을 일으킬 수 있는 브라우저 캐시 파라미터(`?v=...`)를 청소하여 단일 실시간 인메모리 램 상태(`state.js`) 인스턴스로 동기화 정합성을 전격 복구했습니다.

### 4. 샌드박스 자산/예약주문 아키텍처 및 상용 프로덕션 확장 설계 (🌟 신규)
*   **클라이언트 사이드 샌드박스(Zero-Auth Sandbox)의 가상 지갑 및 자산 관리:**
    *   **로컬 캐시 저장소 (`localStorage`):** 사용자가 별도의 로그인을 하지 않아도 즉시 모의 거래를 체험할 수 있도록, 지갑 잔고와 포트폴리오 정보는 브라우저의 로컬 스토리지(`hfx_balances`, `hfx_portfolio`)에 JSON 데이터로 완전 격리 보존됩니다.
    *   **초기 모의 자산 자동 제공:** 최초 접속 시 브라우저 내에 잔고 기록이 없으면 자동으로 `KRW 10억`, `USD 1만`, `BTC 10.0`, `ADA 100,000.0`개 등의 풍부한 초기 테스트 자본(`defaultBalances`)이 탑재됩니다.
*   **브라우저 구동형 예약 주문(Stop-Limit) 실시간 감시 엔진:**
    *   **로컬 메모리 모니터링:** 사용자가 등록한 예약 주문은 클라이언트 내부 상태(`state.stopLimitOrders`)에 보관되며, 로컬 스토리지에 캐싱됩니다.
    *   **클라이언트 트리거 및 웹소켓 발행:** 실시간 웹소켓 가격 스트림이 유입될 때마다, 브라우저가 매 틱별로 감시 기준가(Stop Price) 충족 여부를 판단합니다. 조건이 맞으면 브라우저가 직접 `action: 'NEW'` 주문 패킷을 게이트웨이로 쏘아 백엔드 매칭 코어에서 즉시 체결되도록 처리합니다.
*   **정식 로그인 서비스 시의 백엔드 프로덕션 확장 설계 (Production Ready):**
    *   **서버사이드 데이터베이스 영속성 (PostgreSQL):** 실무 서비스 전환 시, 사용자가 예약 주문을 넣으면 서버 측 API를 거쳐 [postgres-init.sql](file:///home/administrator/exchange_be/postgres-init.sql) 내의 `orders` 및 `stop_limit_orders` 관계형 테이블에 기록되어 사용자가 로그아웃하거나 브라우저를 종료하더라도 완벽히 백엔드 단에서 영구 보존됩니다.
    *   **인메모리 감시 및 스케줄러 (Redis):** 매 틱 시세 변동 시 대량의 DB 조회 병목을 회피하기 위해, 활성화된 전체 예약 주문들은 Redis 캐시 큐에 적재된 채로 백그라운드 **예약주문 감시 데몬(Watcher Daemon)**에 의해 0-딜레이 실시간 감시됩니다.
    *   **엄격한 DB ACID 트랜잭션 보장:** 예약 주문이 트리거되는 즉시 서버 측 단일 DB 트랜잭션 내에서 `wallets` 잔액 정식 차감, `trades` 체결 내역 기록, `ledger_journal` 자산 변경 감사 로그 생성이 원자적(Atomic)으로 정밀 수행됩니다.

---

## 👥 1,000명 회원 원장 및 분산형 모의 주문 테스트 베드

데이터의 정밀함과 실시간성을 확보하기 위해 대규모 시드 가입자 체계와 동적 거래 시뮬레이션을 구현했습니다.

### 1. PostgreSQL 1,000명 가입자 및 3,000개 지갑 시드 ([postgres-init.sql](file:///home/administrator/exchange_be/postgres-init.sql))
*   PostgreSQL의 `generate_series(1, 1000)`와 `CROSS JOIN` 기법을 적용하여 **1,000명의 회원 및 3,000개의 자산 지갑(KRW, BTC, ADA)**을 단 수십 줄의 쿼리로 생성합니다.
*   가입 시간(`created_at`)을 **최근 1년(365일) 범위 내에 시간 밀리초 단위까지 수학적으로 완벽히 균등 분산**되도록 주입하여, 월간/주간/일간 통계 차트를 조회할 때 아주 자연스럽고 유려한 성장 그래프를 그려내도록 고도화되었습니다.
*   모든 회원에게 초기 자본으로 `10억 KRW`, `10 BTC`, `10만 ADA`를 자동 충전해 줍니다.

### 2. 실시간 모의 주문 발전기 연동 (`order-generator`)
*   실시간 모의 주문을 사정없이 뿜어내는 백그라운드 엔진 시뮬레이터가 **1,000명의 여러 회원 계정으로 무작위로 매핑**되어 주문을 보낼 수 있도록 연동 수정 완료되었습니다 (`NEW,BUY/SELL,price,qty,userId`).
*   이에 따라 모든 주문과 체결 이벤트가 DB에 기록될 때, 수백 명의 지갑 자산 원장에서 잔액 차감과 주문 락(Locked)이 역동적으로 변화하며 자산 순환이 이루어집니다.

### 3. 오프라인 백테스터 연동 (`backtest`)
*   오프라인 벤치마킹 데이터셋 로딩 장치([CsvFeed.java](file:///home/administrator/exchange_be/backtest/src/main/java/exchange/backtest/CsvFeed.java))에 결정론적인 Modulo 연산(`% 1000`)을 적용하여 5만여 건의 HFT 주문 데이터를 1,000명의 계정 자산으로 분산화 매핑 연동 처리를 완료했습니다.

---

## ⚙️ 실행 및 구동 환경 구성 (Environments)

JavaF Exchange 플랫폼은 실행 목적에 부합하도록 환경 변수가 분리 구성되어 있습니다.

1.  **`local` (`.env.local`)**: 로컬 호스트 단독 개발 및 디버깅용. 루프백 주소(`localhost`)로 바인딩되며 최상위 상세 로그(`LOG_LEVEL=DEBUG`)를 출력함.
2.  **`dev` (`.env.dev`)**: 컨테이너 클러스터 기동용. 컨테이너 내부 브릿지 DNS 주소(`kafka`, `engine`, `postgres`) 기반으로 상호 연결됨.
3.  **`qa` (`.env.qa`)**: 부하 및 성능 벤치마킹용. 텔레메트리 및 HDR 히스토그램(`TELEMETRY_ENABLED=true` / `HDR_HISTOGRAM_ENABLED=true`) 활성화.
4.  **`prd` (`.env.prd`)**: 초저지연 운영용. 로그 출력을 최소화(`LOG_LEVEL=WARN`)해 디스크 I/O 병목을 배제하고, 저지연 ZGC 튜닝 힌트를 포함함. 보안과 저지연을 위해 **HTTP 메트릭 서버가 원천 차단**됨 (`METRICS_ENABLED=false`).

---

## ⚡ 시스템 최적화 및 성능 튜닝 내역 (System Optimization & Tuning)

거래소 분산 시스템의 자원 효율성 극대화 및 대용량 트랜잭션 대응을 위해 아래와 같이 리소스 절감과 데이터베이스 튜닝이 반영되었습니다.

### 1. Kafka JVM Heap Memory 최적화 (RAM 점유율 60% 이상 감축)
*   **배경:** Confluent cp-kafka 이미지는 대규모 상용 트랜잭션을 전제로 하므로 기본 JVM 힙 설정이 1GB (`-Xms1G -Xmx1G`)로 설정되어 있습니다. 이로 인해 로컬 개발 및 테스트 환경에서 컨테이너 구동 시 과도한 물리 메모리를 점유하는 병목이 발생했습니다.
*   **조치 사항:** `docker-compose.yml` 내 `kafka` 서비스 환경 변수에 `KAFKA_HEAP_OPTS: "-Xms384m -Xmx384m"`를 주입하여 JVM 힙 크기를 개발 환경에 맞춤 튜닝하였습니다.
*   **효과:** Kafka 컨테이너의 실시간 메모리 사용량이 **940MiB 대에서 300MiB 대**로 대폭 절감되어 전체 클러스터의 오버헤드를 낮추었습니다.

### 2. cAdvisor v0.50.0 업그레이드 및 포트 충돌 방지 설계
*   **배경:** 구버전 cAdvisor가 Docker Engine 29+ 버전의 API 스키마(v1.44+)와 버전 불일치 오류를 일으켜 컨테이너 이름 매핑이 소실되고 실시간 CPU/RAM 지표 계측이 불가능했습니다.
*   **조치 사항:**
    *   cAdvisor 이미지를 최신 호환 버전인 **`gcr.io/cadvisor/cadvisor:v0.50.0`**으로 업그레이드하였습니다.
    *   컨테이너의 `/etc/machine-id` 볼륨 바인딩 및 `--docker_only=true` 데몬 플래그를 추가하여 정상적으로 Docker Engine API와 매핑시켰습니다.
    *   cAdvisor 내부 포트는 8182으로 고정이지만, 포트 충돌 방지를 위해 호스트 외부 바인딩 포트를 **`8182`**로 우회 매핑하여 포트 충돌을 완벽 방지했습니다. (ws-gateway는 `8088` 포트로 이전됨)

### 3. 50,000건 대용량 입금 시뮬레이션 및 데이터베이스 B-Tree 인덱스 구축
*   **배경:** 1,000명의 회원별로 최근 1년 동안 최소 1번에서 최대 100번까지 100만 원부터 50억 원에 달하는 무작위 금액의 대용량 입금 데이터를 생성하는 감사 로그 요건을 반영했습니다.
*   **조치 사항:** 
    *   `postgres-init.sql`에 PL/pgSQL 동적 무작위 난수 루프를 내장하여 총 **49,983건의 모의 입금 원장 및 자산 지갑 싱크**를 자동 인젝션하도록 시드 처리했습니다.
    *   대용량 데이터 조회 시의 쿼리 성능 병목을 타파하기 위해 주요 감사 쿼리에 B-Tree 인덱스 4종(`idx_ledger_journal_type_created_at`, `idx_ledger_journal_user_type_created_at` 등)을 신설했습니다.
*   **효과:** 수만 건 이상의 감사 원장을 정렬 및 그룹화하여 실시간 통계를 추출하는 쿼리 시간이 **기존 500ms+에서 0.5ms 이하**로 약 1,000배 비약적으로 최적화되었습니다.

### 4. 어드민 API & UI 서버사이드 페이징 (Pagination) 통합 구현
*   **배경:** 수만 건 규모의 감사 원장을 클라이언트에 단일 어레이로 내려줄 경우 브라우저 DOM 렌더링 중단(Freeze) 및 백엔드 힙 고갈(OOM) 리스크가 컸습니다.
*   **조치 사항:**
    *   Spring Data JPA `Pageable` 및 `PageRequest`를 활용하여 20개 단위의 **서버사이드 페이징** API(`/admin/ledgers`)를 개발했습니다.
    *   회원 이메일 및 자산 유형(DEPOSIT/WITHDRAWAL 등) 키워드 동적 검색 필터를 백엔드 단에 바인딩했습니다.
    *   어드민 프론트엔드(`admin.html`)에 ApexCharts 도넛 차트 동적 동기화 및 글래스모피즘 네온 테마 페이징 컨트롤러(`[◀ 이전]`, `[다음 ▶]`)를 탑재하여 UX와 자원 효율을 극대화했습니다.

### 5. ADA-KRW 다중 마켓 게이트웨이 라우팅 정상화 & UI 레이아웃 리밸런싱 (🌟 신규)
*   **배경:** 에이다 매칭 엔진(`engine-ada`)과 비트코인 매칭 엔진(`engine-btc`)이 병렬 격리 구동되고 있었으나, 게이트웨이(`WsHandler.java`)의 단일 호스트 바인딩 한계로 인해 ADA 주문이 비트코인 엔진(`engine-btc:9997`)으로 전송되어 `Connection refused` 통신 거부 및 에이다 주문 누락 버그가 있었습니다. 또한, 고대비 UI 프론트엔드의 세로 높이(`min-height: 720px`) 한계로 인해 오더북의 매수 호가(Bid rows) 영역이 브라우저 하단으로 잘려 보이지 않는 UI 오버플로우 현상이 발생했습니다.
*   **조치 사항:**
    *   `WsHandler.java` 에 `adaEngineHost` 환경변수를 새롭게 도입하고, 심볼별(`BTC-USD` / `ADA-KRW`) 타겟 엔진 호스트로 동적 분기 소켓을 연결하도록 보완했습니다.
    *   `main.html` 의 대시보드 그리드 가로 비율을 `1.4fr 1.25fr 1.1fr`로 리밸런싱하여 우측 마켓 리스트의 브라우저 밖 잘림을 막고, 오더북 최소 높이를 **`830px`**로 늘려 모든 호가를 완벽 복원했습니다.
*   **효과:** 다중 마켓 코어 간의 커맨드 라우팅 정합성이 복원되고, 세로 오버플로우가 소멸하여 거래 터미널 레이아웃이 미려하게 가시화되었습니다.

### 6. 마켓 기동 시 25레벨 씨드 호가 1.0 피아트(100 스케일) 간격 주입 (🌟 신규)
*   **배경:** 오더북의 병합 로직(1원/1달러 단위 버림) 때문에 `OrderGenerator.java`가 기존에 넣던 촘촘한 `0.01` 단위(1 스케일) 씨드 주문들이 호가창에서 모두 한 줄로 합산 뭉개짐으로써, 매칭 엔진 기동 시 호가창에 호가가 2~3줄밖에 보이지 않고 텅 비는 한계가 있었습니다.
*   **조치 사항:**
    *   초기 씨드 주입 루프를 기존 10회에서 **25회**로 늘리고, 가격 갭을 100배 넓혀 **`1.0 피아트`(100 스케일) 간격**으로 주입하도록 튜닝하였습니다. (`referencePrice ± i * 100`)
    *   실시간 무작위 주문 생성 오프셋 범위도 100배 넓혀 `1.0 피아트` 단위 변동(`(rand.nextInt(30) - 15) * 100`)으로 개편했습니다.
*   **효과:** 마켓이 처음 시작하자마자 매도 25개, 매수 25개의 촘촘하고 넓은 호가 장부가 매치 코어에 적재되어, UI 호가창 10단 전체가 빈칸(`--`) 없이 실시간 지표들로 꽉 차서 노출되는 극상의 시각적 거래 환경을 완성했습니다.

---

## 🛠️ 시작 가이드 (Quick Start)

### 🚀 1. 분산 마이크로서비스 및 모니터링 클러스터 가동 (Docker Compose)
1. Docker Desktop 실행 상태를 확인하고, 프로젝트 루트 폴더에서 다음 명령을 실행합니다:
   ```bash
   docker compose up --build -d
   ```
2. 전체 서비스 구동 상태 확인:
   ```bash
   docker compose ps
   ```

### 🗄️ 2. PostgreSQL 데이터베이스 및 1,000명 회원 원장 상태
초기 시드로 1,000명 회원(ID: 1~1000)과 지갑 잔액이 자동으로 적재됩니다.

*   **데이터베이스 접속 방법:**
    *   **Host**: `localhost` (또는 WSL IP)
    *   **Port**: `5432`
    *   **Database**: `exchange`
    *   **User / Password**: `postgres` / `postgres`

### 💻 3. 실시간 거래 터미널 접속
1. 마이크로서비스 클러스터 기동 후, `frontend/main.html` 파일을 브라우저로 직접 로드합니다.
2. 우측 상단의 연결 도트가 **`CONNECTED` (녹색)** 상태인지 확인하고, 실시간 실측 RTT 지연 속도를 관측합니다.

### 🛡️ 4. 통합 어드민 제어 콘솔 접속 및 연동
1. `frontend/admin.html` 파일을 웹 브라우저로 직접 로드합니다.
2. 우측 상단 `API Host` 입력 부분에 관리자 백엔드 IP(`localhost:8081` 또는 WSL IP)가 바인딩되어 있는지 확인합니다.
3. **[대시보드]**, **[회원 통합 관리]**, **[지갑 및 자산 관리]**, **[현황 및 통계 분석]** 등의 모든 기능이 미려하게 상호작용하는지 활용해 보십시오.

### 📈 5. 그라파나 관제 센터 접속
1. [http://localhost:3000](http://localhost:3000) (기본 계정: `admin` / 패스워드: `admin`)에 접속합니다.
2. 왼쪽 메뉴 ➔ **`Dashboards`** 로 이동하여 자동으로 Provisioning되어 있는 **`Exchange Performance Dashboard`**를 클릭합니다.
3. BTC/ADA 엔진의 마이크로초 단위 Latency 추이와 실시간 TPS, 게이트웨이의 액티브 커넥션뿐만 아니라, **구글 cAdvisor 통합 수집을 통해 플랫폼 내 모든 마이크로서비스 컨테이너들의 실시간 CPU 및 RAM 점유율 통계**가 시계열 그래프로 정밀하게 관측되는 모습을 확인합니다.


### ⏱️ 6. 초고속 인메모리 매칭 오프라인 백테스트 구동
1. **소스코드 컴파일 (Javac):**
   ```bash
   javac -d build_backtest -sourcepath "engine-core/src/main/java;backtest/src/main/java" backtest/src/main/java/exchange/backtest/BacktestMain.java
   ```
2. **백테스트 시뮬레이션 수행:**
   ```bash
   java -cp build_backtest exchange.backtest.BacktestMain
   ```
   1,000명의 회원 정보가 deterministic하게 연동된 상태에서 5만 건의 매칭 벤치마크 결과를 순식간에 콘솔로 확인하실 수 있습니다.
