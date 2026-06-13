# 🌌 JavaF Exchange (HF-X)

초저지연(Ultra-Low Latency) 인메모리 가격-시간 우선(FIFO) 매칭 엔진, 실시간 시세 분배 웹소켓 게이트웨이, 초고속 오프라인 백테스팅 프레임워크를 갖춘 차세대 암호화폐/증권 거래소 백엔드 플랫폼. 

최근 **비동기 이벤트 소싱(Event Sourcing) 기반 PostgreSQL 실시간 자산 정산(Settle) 파이프라인**, **고대비 다크 테마 터미널(JavaF)**, **ADA-KRW 멀티 심볼 병렬 확장**, **진짜 RTT 네트워크 지연 실측**, **rAF 기반 호가창 렌더링 스로틀링**, **Prometheus & Grafana 기반 0-의존성 초경량 성능 계측 체계**, **Spring Boot 기반 통합 어드민 API & 어드민 대시보드 콘솔**, 그리고 **초현대식 React 19 + TypeScript + Vite 기반의 고성능 실시간 관제 어드민 터미널**이 추가 완비됨.

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
    AdminUI[Admin Dashboard UI: admin.html] <-->|REST API / JSON| AdminAPI[Spring Boot Admin API: 8181]
    
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
| **`admin-api`** | Spring Boot 통합 어드민 백엔드 | **`8181`**                     | **`8181`**                     | 어드민 대시보드 연동용 REST API 포트.                                                                                                     |
| **`cadvisor`** | 실시간 컨테이너 리소스 계측 에이전트 | **`8182`**                     | **`8182`**                     | ⚠️ **포트 충돌 방지 회피 설계**:<br>내부 포트는 `8182`으로 고정이지만, 포트 충돌 방지를 위해 호스트 외부 포트를 **`8182`**로 우회 매핑하였습니다. (ws-gateway는 `8088` 포트로 이전됨) |
| **`postgres`** | 회원/자산/정산 관계형 데이터베이스 | **`5432`**                     | **`5432`**                     | 데이터베이스 단독 포트 바인딩.                                                                                                             |
| **`prometheus`** | 분산 메트릭 수집 및 시계열 DB | **`9090`**                     | **`9090`**                     | 프로메테우스 웹 콘솔 접속 포트.                                                                                                            |
| **`grafana`** | 실시간 계측 시각화 대시보드 | **`3000`**                     | **`3000`**                     | 그라파나 대시보드 웹 UI 접속 포트 (ID/PW: admin/admin).                                                                                    |
| **`engine-btc`** | BTC-USD 매칭 엔진 (인메모리 코어) | **`9999`**<br>`9998`<br>`9100` | **`9999`**<br>`9998`<br>`9100` | TCP 커맨드 수신 (9999)<br>TCP 체결 이벤트 송신 (9998)<br>프로메테우스 메트릭 (9100)                                                                |
| **`engine-ada`** | ADA-KRW 매칭 엔진 (인메모리 코어) | **`9997`**<br>`9996`<br>`9101` | **`9997`**<br>`9996`<br>`9101` | TCP 커맨드 수신 (9997)<br>TCP 체결 이벤트 송신 (9996)<br>프로메테우스 메트릭 (9101)                                                                |
| **`kafka`** | 분산 실시간 메시지 브로커 | **`29092`**<br>`9092`          | **`29092`**<br>`9092`          | 외부 개발기 접속용 (29092)<br>컨테이너 내부 브릿지용 (9092)                                                                                     |
| **`zookeeper`** | 카프카 메타데이터 제어/조율 관리자 | **`2181`**                     | **`2181`**                     | 카프카 클러스터 내부 조율용.                                                                                                              |
| **`loki`** | 중앙집중형 실시간 로그 저장소 | **`3100`**                     | **`3100`**                     | 그라파나 로키 로그 수집 서버 포트.                                                                                                            |
| **`kafka-exporter`** | 카프카 브로커 성능/지연 계측 어댑터 | **`9308`**                     | **`9308`**                     | 카프카 메트릭 노출용 포트 (Prometheus 연동).                                                                                                 |

---

## 🛡️ 통합 어드민 제어 시스템 (Admin Console)

거래소 운영 효율성 극대화 및 실시간 정산 감사를 지원하는 통합 어드민 솔루션이 완비되었습니다.

### 1. Spring Boot 기반 REST API 백엔드 (`admin-api`)
*   **통화별 총 유통 자산 지표 조회 (`/admin/wallets/summary`):** 거래소 내에 보관된 전체 자산(KRW, USD, BTC, ADA)의 사용 가능한 잔액 및 거래 진행중 락(Locked)이 걸린 자산의 합산 수치를 원자적으로 조회합니다.
*   **실시간 성능 및 시스템 통계 요약 (`/admin/stats/summary`):** 총 등록 회원 수, 활성 지갑 수, 금일 누적 매칭 거래 수, 누적 거래 대금(Volume)을 즉각 취합하여 반환합니다.
*   **거래소 실적 분석 통계 조회 (`/admin/stats/performance`):** (🌟 신규) 마켓별 누적 및 24시간 수수료 수입, 24H DAU / 30D MAU, 자산 유통 속도(Trading Velocity), 오더 체결 성공률 및 경쟁사(Binance, Upbit, Coinbase) 성능 벤치마킹 통합 분석 데이터를 반환합니다.
*   **마켓별 동적 수수료율 설정 및 조회 (`/admin/settings`):** (🌟 신규) `POST` 요청을 통해 `btcUsdFeeRate` 및 `adaKrwFeeRate` 수수료 설정을 동적으로 변경하고 DB 영속화와 인메모리 `AdminSettings` 캐시 동기화를 즉시 처리합니다.
*   **유입 유저 지표 조회 (`/admin/stats/users`):** 일간, 주간, 월간, 분기, 연간 해상도 변수(Resolution)를 주입받아 시간에 따른 신규 회원 가입 유입량을 반환합니다.
*   **매칭 거래 분석 및 자산 변경 이력 조회 (`/admin/stats/trades` / `/admin/stats/assets`):** 기간별 거래소 내의 원화 및 USD, 각종 코인 자산의 증감 흐름과 누적 체결 수치를 다각도로 조회합니다.
*   **회원 원장 관리 (CRUD):** 회원 가입 등록(`POST /admin/users`), 정보 수정(`PUT /admin/users/{id}`), VIP 등급/거래정지(SUSPENDED) 관리 기능이 완벽 제공됩니다.
*   **감사 연동 자산 추가/차감 (`/admin/users/{id}/assets/adjust`):** 관리자가 특정 회원의 자산 지갑을 즉각 지급(Deposit) 또는 회수(Withdrawal)할 수 있는 안전한 REST API를 제공하며, 모든 변동분은 `ledger_journal` 감사용 테이블에 완전 보장됩니다.
*   **Spring Security & JWT 기반 무상태 인증/인가 체계 및 RTR(Refresh Token Rotation) 도입 (🌟 신규):**
    *   **강력한 API 보호:** 모든 `/admin/**` 엔드포인트를 Spring Security 6 필터 체인으로 보호하고, `ADMIN` 등급을 보유한 인증된 관리자만 접근 가능하도록 엄격히 통제함.
    *   **Stateless JWT 인증:** 무상태 세션 관리 모델을 탑재하여 서버 메모리나 세션 저장소 부하 없이 헤더의 `Authorization: Bearer <Access_Token>`을 고속 해독해 자격 증명을 수립함.
    *   **RTR (Refresh Token Rotation) 토큰 회전 기법:** 사용자가 Access Token 만료로 갱신 요청(`POST /admin/auth/refresh`)을 보내면, 기존 Refresh Token을 즉시 폐기(일회성)하고 새로운 Access/Refresh Token 쌍을 자동 재발급함. 이를 통해 Refresh Token 탈취 및 재사용(Replay) 공격을 원천 방지함.
    *   **안전한 하이브리드 비밀번호 인코더:** 신규 비밀번호는 솔트가 가미된 강력한 `BCrypt` 알고리즘으로 암호화하여 저장하며, 데이터베이스 내 기존 1,000명의 레거시 SHA-256 및 시드 목(Mock) 데이터 비밀번호도 안전하게 호환 대조되도록 구현함.
    *   **기본 관리자 계정 자동 시딩 & 기동 동기화 (🌟 local/dev 한정):** 시스템 기동 시 기본 관리자 계정(`admin@javaf.net` / `admin123`, `ADMIN` 등급)의 존재 여부를 검사하고 계정을 자동 주입함. 로컬(`local`) 및 컨테이너 개발(`dev`) 프로파일 활성화 시에만 데이터베이스 기동 시점 대기 루프(최대 15회 재시도)를 통해 PostgreSQL 초기화 완료 후 안전하게 `users_user_id_seq` 시퀀스를 동기화하고 기본 관리자 계정을 시딩함. 운영(`prod`) 프로파일 기동 시에는 보안 취약 방지를 위해 자동 시딩 및 스키마 임시 DDL 조작이 완전 차단됨.
*   **JPA Auditing 및 AOP 기반 스레드 안전 등록자/수정자 자동 이원화 주입 아키텍처 (🌟 신규):**
    *   **전체 테이블 Auditing 확장:** `users`뿐만 아니라 `wallets`, `ledger_journal`, `crypto_withdrawals`, `user_crypto_addresses`, `system_hot_wallets`, `trades` 등 전체 영속성 엔티티가 `BaseEntity`를 공동 상속하게 설계하여 오디팅 컬럼(`createdAt`, `updatedAt`, `createdBy`, `updatedBy`) 구성을 전체 테이블에 일괄 이식함.
    *   **AOP 기반 스레드 안전 이원화 기록 (`@SystemAuditor`):** 
        *   **사용자 주체 작업:** 어드민 대시보드 API 호출 등 로그인한 사용자가 요청할 때는 Spring Security of Principal(이메일 등) 정보가 `createdBy` / `updatedBy`에 자동으로 주입됩니다.
        *   **시스템 주체 작업:** 백그라운드 데몬, 스케줄러, 카프카 컨슈머 등 백그라운드 시스템이 작업을 유발할 때는 `@SystemAuditor("시스템식별자")` 어노테이션을 부착하여 스레드 안전하게 ThreadLocal을 관리하며, 이를 통해 등록자/수정자에 `"SYSTEM:시스템식별자"`가 자동 기록됩니다.
        *   **메모리 누수 방지 가드:** AOP Aspect 내의 `finally` 절에서 ThreadLocal 리소스를 강제 해제(`remove()`)함으로써 WAS 스레드 풀 환경에서의 오염이나 OOM (Memory Leak) 리스크를 원천 제거하였습니다.
    *   **시작 시 DDL 자동 마이그레이션 적용:** 서버 최초 기동 시 데이터베이스 테이블들을 역동적으로 검사하여 누락된 오디팅 관련 컬럼을 자동 생성(`ALTER TABLE`)하고 동기화하도록 `AdminApiApplication` 실행 주기를 고도화함.
*   **PostgreSQL 성능 최적화:** 500 에러를 유발할 수 있는 복잡한 Native Time-Bucket Parameter Binding 문제점을 표준적인 `GROUP BY 1, 2, 3` 및 `ORDER BY 1 DESC` 인덱스 기법으로 튜닝 완료했습니다.

### 2. 프리미엄 다크 글래스모피즘 웹 어드민 ([admin.html](./frontend/admin.html))
*   **완벽한 UI와 로직의 분리 (ES6 모듈화):** 기존 2,200라인에 육박하던 비대한 단일 HTML 파일에서 인라인 자바스크립트 전체를 분리 추출하여 **의존성 제로의 독립적인 ES6 모듈 파일인 [admin.js](./frontend/js/admin.js)로 리팩토링**을 완료했습니다. 이를 통해 UI/Style 레이어와 비즈니스 로직 레이어를 완벽히 차단 격리하여 고성능 유지보수 구조를 100% 확보했습니다.
*   **🌌 실시간 마켓 감시 모니터 (TradingView Charts) 패널 (🌟 신규):** 어드민 대시보드 내에 실시간 시세 및 캔들을 안전하게 모니터링할 수 있는 하이엔드 모니터링 패널을 전격 추가 마운트했습니다.
    *   **어드민 전용 보라색 테마 차트:** 캔들 및 거래량 그래프뿐만 아니라 MA7(주황), MA25(분홍) 네온 이동평균선을 오버레이하여 리얼타임 기술 지표 추세를 제공합니다.
    *   **실시간 웹소켓 체결 로그 모니터:** Netty 게이트웨이(Port 8088)의 초경량 32바이트 바이너리 패킷 디코더와 즉시 바인딩하여, 체결 이벤트를 수신하자마자 `[체결 ID | 종목 | 구분 | 체결가 | 수량 | 대금 | 시각]` 형태의 스크롤형 실시간 로그 테이블을 갱신합니다.
    *   **다중 해상도 및 종목 스위칭:** `BTC-USD`와 `ADA-KRW` 간의 원클릭 스위칭 및 `1M/5M/15M/1H` 탭 기동 시 **시간 축 결함 극복 안전 가드(Time-Bound Safety Guard)**를 작동시켜 오래된 시간 버킷 틱에 의한 Lightweight Charts 엔진 마비 현상을 완전히 물리쳤습니다.
*   **ApexCharts 인터랙티브 통계 분석:** CDN 기반 하이엔드 차트 라이브러리 연동으로 일간, 주간, 월간, 분기, 연간 필터링에 따른 가입 추이, 체결 건수/대금, 자산 입출금 비율 도넛 차트 구현.
*   **통합 회원 관리 모달:** 모달 윈도우를 활용해 이메일 실시간 계정 검색, 신규 회원 등록, 상태 변동, 자산 추가/차감(Deposit/Withdrawal)을 즉시 실시간 인젝션 조작합니다.
*   **WSL/네트워크 바인딩 게이트웨이:** 우측 상단의 `API Host` 입력창을 통해 WSL 가상 머신 IP나 원격 도메인 IP를 동적으로 주입하여 즉시 REST API 커넥션을 수립할 수 있도록 설계했습니다.

### 3. 초현대식 React + TypeScript 고성능 실시간 관제 터미널 ([frontend-admin](./frontend-admin)) (🌟 신규)
*   **Zustand 기반 초저지연 상태 관리:** 기존 DOM 직접 제어 한계를 완벽히 극복하여, 32바이트 바이너리 패킷 파싱 스펙을 포함한 모든 거래소 실시간 상태를 반응형 스토어로 관리합니다.
*   **거래소 실적 분석 (Performance Console) 콘솔 탭 연동:** (🌟 신규) 누적 및 24시간 수수료 수익, DAU/MAU 고착도, 30일 순입금 흐름(Net Deposit Flow), 오더 성공률 Progress Bar, 경쟁사 벤치마킹 테이블 지표 등 실시간 통합 실적을 관제합니다.
*   **마켓별 동적 수수료율 설정 제어판:** (🌟 신규) 시스템 환경 설정 탭 내부에서 BTC-USD 및 ADA-KRW 마켓의 수수료율(%)을 관리자가 직접 실시간 변경 및 저장할 수 있는 입력 필드를 구축했습니다.
*   **TradingViewChart 모듈 컴포넌트화:** 이중 시간 보장 안전 필터(Outdated Tick Guard)와 하이브리드 보정 패딩 엔진을 React 훅 생명주기(`useEffect`, `useRef`)에 맞춰 완벽 모듈화하여, 가로가 짤리거나 깨지는 현상을 100% 원천 예방했습니다.
*   **실시간 모의 주문 생성 로그 콘솔 토글 기능:** (🌟 신규) 브라우저 렌더링 리소스 소모 및 시각적 번잡함을 줄이기 위해 모의 주문 생성 로그 콘솔 카드를 접고 펼 수 있는(On/Off) 토글 UI를 추가 구축했습니다. 콘솔을 비활성화할 경우 React DOM에서 텍스트 영역을 완전히 제거(Conditional Rendering)하여 브라우저의 Repaint/Reflow 연산 부하를 0으로 배제합니다.
*   **DevOps 환경변수 연동 시스템 이식:** 런타임에 동적으로 `/config.json`을 가져와 API 엔드포인트를 마운트하고 부재 시 로컬로 안정적 자동 폴백하는 인쇄형 설계를 이식 완료했습니다.

---

## 🌌 거래자 포털 및 5대 핵심 회원 기능 (Trader Portal & Advanced Features)

실감 나는 실시간 모의 거래 경험과 한 단계 높은 사용자 보안을 실현하기 위해, 단일 HTML이었던 터미널 코드를 **의존성 제로의 고성능 Vanilla ES6 모듈 구조로 모듈화**하고 **5대 핵심 회원 서비스**를 전격 마운트하였습니다.

### 1. 초경량 Vanilla ES6 모듈화 아키텍처 (DOM/라인 -90% 경량화)
*   **`main.html` 경량화:** 기존 2,450여 라인의 비대해진 HTML 파일에서 인라인 CSS 스타일 및 복잡한 웹소켓 수신 스크립트를 완전 제거하여 **280라인 미만의 순수 HTML5 뼈대로 리팩토링**했습니다.
*   **역할 분담형 ES6 Modules 격리 설계:**
    *   **[state.js](./frontend/js/state.js):** 지갑 잔고, 오더북, 체결 정보 등 전역 상태를 싱글톤 구조로 관리하는 단일 상태 소스(Source of Truth).
    *   **[auth.js](./frontend/js/auth.js):** **[2FA OTP 보안인증 및 로그인 기기 감사]** 캡슐화.
    *   **[wallet.js](./frontend/js/wallet.js):** 가상 지갑 잔고 가감, 트랜잭션 기록 및 **[입출금 제어판 모달]** 관리 캡슐화.
    *   **[terminal.js](./frontend/js/terminal.js):** Presets 비율 슬라이더 제어, **[지정가/시장가/예약주문 탭 전환]** 및 액티브 주문 제어 캡슐화.
    *   **[orderbook.js](./frontend/js/orderbook.js):** 오더북 10레벨 병합 연산, rAF 호가 드로잉 및 누적 Hover 툴팁 캡슐화.
    *   **[chart.js](./frontend/js/chart.js):** 캔버스 변동 틱 그래프 네온 드로잉 캡슐화.
    *   **[gateway.js](./frontend/js/gateway.js):** 초저지연 바이너리 패킷 디코더, RTT 핑퐁 및 Throughput(TPS) 자동 측정 캡슐화.
    *   **[app.js](./frontend/js/app.js):** 각 모듈들의 순차적 부트스트랩 및 웹소켓 데이터 연동을 조율하는 메인 애플리케이션 엔트리.

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
    *   **서버사이드 데이터베이스 영속성 (PostgreSQL):** 실무 서비스 전환 시, 사용자가 예약 주문을 넣으면 서버 측 API를 거쳐 [postgres-init.sql](./postgres-init.sql) 내의 `orders` 및 `stop_limit_orders` 관계형 테이블에 기록되어 사용자가 로그아웃하거나 브라우저를 종료하더라도 완벽히 백엔드 단에서 영구 보존됩니다.
    *   **인메모리 감시 및 스케줄러 (Redis):** 매 틱 시세 변동 시 대량의 DB 조회 병목을 회피하기 위해, 활성화된 전체 예약 주문들은 Redis 캐시 큐에 적재된 채로 백그라운드 **예약주문 감시 데몬(Watcher Daemon)**에 의해 0-딜레이 실시간 감시됩니다.
    *   **엄격한 DB ACID 트랜잭션 보장:** 예약 주문이 트리거되는 즉시 서버 측 단일 DB 트랜잭션 내에서 `wallets` 잔액 정식 차감, `trades` 체결 내역 기록, `ledger_journal` 자산 변경 감사 로그 생성이 원자적(Atomic)으로 정밀 수행됩니다.

---

## 👥 1,000명 회원 원장 및 분산형 모의 주문 테스트 베드

데이터의 정밀함과 실시간성을 확보하기 위해 대규모 시드 가입자 체계와 동적 거래 시뮬레이션을 구현했습니다.

### 1. PostgreSQL 1,000명 가입자 및 3,000개 지갑 시드 ([postgres-init.sql](./postgres-init.sql))
*   PostgreSQL의 `generate_series(1, 1000)`와 `CROSS JOIN` 기법을 적용하여 **1,000명의 회원 및 3,000개의 자산 지갑(KRW, BTC, ADA)**을 단 수십 줄의 쿼리로 생성합니다.
*   가입 시간(`created_at`)을 **최근 1년(365일) 범위 내에 시간 밀리초 단위까지 수학적으로 완벽히 균등 분산**되도록 주입하여, 월간/주간/일간 통계 차트를 조회할 때 아주 자연스럽고 유려한 성장 그래프를 그려내도록 고도화되었습니다.
*   모든 회원에게 초기 자본으로 `10억 KRW`, `10 BTC`, `10만 ADA`를 자동 충전해 줍니다.

### 2. 실시간 모의 주문 발전기 연동 (`order-generator`)
*   실시간 모의 주문을 사정없이 뿜어내는 백그라운드 엔진 시뮬레이터가 **1,000명의 여러 회원 계정으로 무작위로 매핑**되어 주문을 보낼 수 있도록 연동 수정 완료되었습니다 (`NEW,BUY/SELL,price,qty,userId`).
*   이에 따라 모든 주문과 체결 이벤트가 DB에 기록될 때, 수백 명의 지갑 자산 원장에서 잔액 차감과 주문 락(Locked)이 역동적으로 변화하며 자산 순환이 이루어집니다.
*   **동적 모의 주문 총량 제어 (`MAX_ORDERS` env 추가)**:
    *   테스트 실행 시 리소스 관리 및 정밀 벤치마킹을 위해 가상 주문의 총 누적 생성 한도(`MAX_ORDERS`)를 환경 변수 또는 각 환경 프로필 파일(`.env.local`, `.env.dev`, `.env.qa`, `.env.prd`)로부터 동적으로 주입받아 제어할 수 있도록 구현했습니다.
    *   설정되지 않은 경우 무제한(정수형 최대치 `Integer.MAX_VALUE`)으로 자동 폴백되며, 설정된 수치에 도달하면 가상 주문 스레드가 자동으로 정지하여 과도한 데이터베이스 쓰기 I/O 및 자원 낭비를 원천 차단합니다.

### 3. 오프라인 백테스터 연동 (`backtest`)
*   오프라인 벤치마킹 데이터셋 로딩 장치([CsvFeed.java](./backtest/src/main/java/exchange/backtest/CsvFeed.java))에 결정론적인 Modulo 연산(`% 1000`)을 적용하여 5만여 건의 HFT 주문 데이터를 1,000명의 계정 자산으로 분산화 매핑 연동 처리를 완료했습니다.

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

### 7. 웹소켓 연결 즉시 최신 오더북 Full Snapshot HTTP 동기화 파이프라인 탑재 (🌟 신규)
*   **배경:** 본 플랫폼은 초저지연 성능을 위해 바이너리 델타(수량 증감분) 스트림 위주로 웹소켓 통신을 처리하고 있었습니다. 그러나 브라우저를 새로고침(F5)하거나 최초 진입할 때 클라이언트 메모리 맵이 초기화되어, 새로운 실시간 체결이 발생하기 전까지 매도/매수 호가창이 빈칸(`--`)으로 덩그러니 방치되거나 불완전하게 복구되는 한계가 존재했습니다.
*   **조치 사항:**
    *   `MatchingEngine.java` 코어에 `getOrderBook()` 및 `getSeq()` 메소드를 public으로 선언하여 인메모리 호가 실시간 추출을 지원케 하였습니다.
    *   기존 Prometheus Scraper 포트(`9100`, `9101`)에 CORS 정책(`Access-Control-Allow-Origin: *`)을 적용한 **`SnapshotHandler`** REST API 엔드포인트 `/snapshot`을 전격 신설했습니다.
    *   매칭 엔진 기동 후 참조가 안전하게 전달되도록 `EngineRunner.java` 가동 라이프사이클을 교정하여 `MetricsServer.getInstance().start(engine)` 의존성을 완벽하게 주입했습니다.
    *   프론트엔드 모듈 `gateway.js` 내에 비동기 **`fetchSnapshot(symbol)`** 파이프라인을 구축하여 웹소켓 `onopen` 성공 즉시 REST 스냅샷을 1회 동기식 강제 패치한 후 맵을 통째로 덮어쓰고 델타 패킷 누적 가산을 시작하게 설계했습니다.
*   **효과:** 새로고침(F5)을 하더라도 1초의 딜레이도 없이 매도/매수 호가창이 25레벨 백엔드 실시간 스냅샷 데이터로 즉각 채워지며, 그 위로 실시간 델타 업데이트 및 애니메이션이 완벽히 이어지는 초정합성 동기화를 구현하였습니다.

### 8. 무작위 가격 결정 모델의 음의 편향 가드 및 최저가 방어선 보완 (🌟 신규)
*   **배경:** 주문 시뮬레이터(`OrderGenerator.java`)가 5% 확률로 기준가(`referencePrice`)를 난수 변동시킬 때 사용된 `(rand.nextInt(6) - 3) * 100` 공식은 수학적으로 기댓값이 **`-0.5`인 우하향 편향(Negative Drift)**을 띠고 있었습니다. 이로 인해 최초 가격이 낮았던 에이다 마켓(`ADA-KRW` 시작가 50,000)은 시스템이 장시간(21시간 이상) 기동됨에 따라 가격이 `0` 이하로 계속 떨어져 마이너스 호가(예: ₩-166.00)로 수렴하고 화면 레이아웃을 왜곡시키는 기현상이 발생했습니다.
*   **조치 사항:**
    *   `OrderGenerator.java` 내부에 하한 가격 보호 블록(Floor minPrice)을 신설하여, 실시간 생성 가격과 기준가(`referencePrice`)가 절대 정상 범주 미만으로 감소하지 못하도록 예방 조치했습니다. (에이다 마켓 ₩10.00 / 1000L 하한선 고정, 비트코인 마켓 $10,000.00 / 1,000,000L 하한선 고정)
    *   새로운 설정에 맞게 시뮬레이터 이미지를 도커 컴포즈로 다시 컴파일(`docker compose up --build -d order-generator`)하고 매칭 엔진 메모리를 클린 리셋하였습니다.
*   **효과:** 장시간 무인 구동하더라도 마켓 가격이 절대 음수로 표류(Drift)하는 문제를 원천 해결하였으며, 매수 497원 / 매도 504원 등 상식적이고 정교한 실시간 스프레드 갭을 무한히 안정적으로 유지할 수 있는 테스트 환경을 완성했습니다.

### 9. 코인별 최종 체결 현재가 1초 인메모리 캐싱 및 초고속 화면 렌더링 (🌟 신규)
*   **배경:** 기존 프론트엔드 거래 터미널은 새로고침(F5) 하거나 최초 로드 시, 백엔드 데이터베이스 상에 이미 수많은 거래 기록과 최종 체결 가격이 존재함에도 불구하고 무조건 정적으로 하드코딩된 기본값(BTC $65,000 / ADA ₩500)으로 인풋 필드가 채워지는 한계가 있었습니다. 이를 해결하기 위해 매번 데이터베이스를 조회할 경우 디스크 I/O 및 쿼리 오버헤드가 막대하여, DB에 부하를 주지 않으면서도 실시간 가격 정합성을 즉시 보장해줄 수 있는 경량 고성능 캐싱 체계가 필수적이었습니다.
*   **조치 사항:**
    *   **백엔드 (`admin-api`):** Spring Boot 서버의 메모리 영역에 가벼우면서도 동시성 제어가 보장되는 `ConcurrentHashMap` 기반의 커스텀 **1초 만료 캐시(Custom In-Memory 1-Second PriceCacheEntry)**를 탑재하였습니다. 캐시 미스 발생 시에만 Postgres 테이블의 `findFirstBySymbolOrderByTradeIdDesc` 고속 인덱스 스캔 쿼리를 수행하여 최종 체결가를 반환하도록 `StatsService.java` 및 `StatsController.java` (`GET /admin/stats/ticker`)를 확장 구축했습니다.
    *   **프론트엔드 (`app.js`):** 프론트엔드가 최초 화면 로딩(`DOMContentLoaded`)을 하거나 사용자가 종목 탭을 스위칭(`switchSymbol`)할 때, 비동기 헬퍼 함수 **`syncLastPriceFromServer(symbol)`**를 즉시 가동하여 어드민 API로부터 최종 체결 현재가를 실시간 동적 적재하게 바인딩했습니다. 가져온 실제 가격에 소수점 스케일을 조정한 후 터미널 입력값(`order-price`)에 반영하여 동적 계산 이벤트(`input`)를 즉시 트리거하게 설계했습니다.
*   **효과:** 레디스(Redis)와 같은 불필요한 별도 인프라 컨테이너 추가 없이도 고성능 1초 캐시를 통해 데이터베이스에 미치는 부하를 0으로 수렴시켰으며, 브라우저 로드 즉시 실제 백엔드 거래 데이터 원장과 100% 일치하는 정확한 현재가가 거래 터미널에 즉각 세팅되는 고정밀 극강의 UX를 실현했습니다.

### 10. TradingView Lightweight Charts & 다중 해상도 및 이동평균선(MA7, MA25) 지표 탑재 (🌟 신규)
*   **배경:** 기존 거래 터미널은 단순 선형 HTML5 2D Canvas 차트만을 제공하여, 봉(Candlestick) 차트 분석, 거래량(Volume) 히스토그램 시각화, 마우스 호버 오버레이 툴팁 정보 등의 프로페셔널한 트레이더 관점을 제공하는 데 명확한 한계가 존재했습니다.
*   **조치 사항:**
    *   **차트 라이브러리 엔진 교체:** 바이낸스, 코인마켓캡 등에서 업계 표준으로 쓰이는 고성능 **TradingView Lightweight Charts** 엔진을 CDN으로 전격 도입하고, 기존 Canvas 단선 차트를 완전히 들어냈습니다.
    *   **다중 시간 해상도 지원 (1M, 5M, 15M, 1H, 1W, 1MO, 1Y):** 백엔드(`admin-api`) 및 프론트엔드 연동을 확장하여 1분 봉, 5분 봉, 15분 봉, 1시간 봉 단위 해상도뿐 아니라 주봉(1W), 월봉(1MO), 연봉(1Y) 해상도까지 동적으로 제공합니다. 백엔드의 Java 서비스 계층 메모리 상에서 실시간 시간 분할 내림 연산 그룹핑을 고속 수행하여 dynamic fetch해 줍니다.
    *   **금융 기술 보조지표 (이동평균선 MA7, MA25) 연동:** 캔들스틱 차트 위에 주황색(MA7) 및 분홍색(MA25) 네온 지표 선을 오버레이로 드로잉했습니다. 과거 데이터 및 실시간 웹소켓 체결 스트림 수신 시에도 이동평균을 온더플라이로 다이내믹하게 실시간 계산·업데이트하여 꼬리가 부드럽게 들썩이도록 파이프라인을 설계했습니다.
    *   **자세하고 친절한 한글 주석 보완:** 모든 데이터 처리 수식, 집계 알고리즘 및 API 통신 모듈마다 상세한 한글 주석을 부착하여 코드 가독성과 유지보수성을 극적으로 향상시켰습니다.
*   **효과:** 실제 데이터베이스 체결 원장 데이터의 완벽한 융합에 더해 다중 분석 시간 및 전문 이동평균선 보조지표까지 100% 매칭시켜 코인마켓캡과 차이가 없는 명실상부한 프리미엄 암호화폐 거래 플랫폼 차트를 최종 완성했습니다.

### 11. 🌌 History 체결 10만 건 DB 시딩 및 하이브리드 차트 캔들 보정 패딩 엔진 (이중 보장 아키텍처) (🌟 신규)
*   **배경:** 거래소 최초 기동 시 또는 거래 활동이 저조한 기간 동안에는 데이터베이스의 체결 데이터가 부족하여 차트 왼쪽 영역이 텅 빈 상태로 보이거나 실시간 틱만 몇 개 노출되어 미관을 심각하게 헤치고 프리미엄 미학 경험을 훼손하는 한계가 있었습니다.
*   **조치 사항 (이중 보장 아키텍처):**
    1.  **초고속 PL/pgSQL 10만 건 DB 시딩:** [postgres-init.sql](file:///home/administrator/exchange_be/postgres-init.sql) 내부에 집합 기반(`generate_series`) 벌크 주문 및 체결 생성기를 내장하여, `BTC-USD` 5만 건 및 `ADA-KRW` 5만 건의 실제 24시간 역사 거래 데이터를 데이터베이스 초기 구동 단계에서 **단 150ms**만에 무결하게 인젝션하도록 설계했습니다. 삼각함수(`sin`) 파동과 랜덤 변동 노이즈 모델을 활용하여 아름답고 자연스러운 시세 캔들 및 이동평균선 추세를 완전 복원했습니다.
    2.  **하이브리드 캔들 보정 패딩 엔진:** 백엔드 조회 데이터가 100건보다 적은 극단적 상황을 완벽 방지하기 위해 프론트엔드 [chart.js](file:///home/administrator/exchange_be/frontend/js/chart.js)에 클라이언트 보정 엔진을 추가 탑재했습니다. API로 리턴받은 최초의 실제 데이터의 시작가(`open`)와 시간축 기준 역방향으로 부드러운 랜덤워크 보정 캔들을 생성하고 unshift 병합 처리하여, 가상 데이터와 실제 시세 흐름의 이음새가 100% 제로-갭(Zero-Gap)으로 연속성을 띠는 최고 품질의 차트 렌더링을 구현했습니다.
*   **효과:** 최초 진입 및 마켓 스위칭을 하는 즉시 차트 전체 영역이 자연스러운 시세 Candlestick 파동과 거래량 히스토그램, 유려하게 흐르는 Neon 이동평균선(MA7, MA25)으로 가득 채워지는 압도적인 프리미엄 비주얼 품질을 100% 보장하게 되었습니다.

### 12. 주봉(1W), 월봉(1MO), 연봉(1Y) 차트 해상도 지원 및 대용량 트레이드 집계 확장 (🌟 신규)
*   **배경:** 사용자 포털과 어드민 대시보드에서 기존 `1m/5m/15m/1h` 해상도뿐만 아니라 중장기 시세 추세를 볼 수 있는 주봉, 월봉, 연봉 해상도가 필요하였습니다. 넓은 시간 간격의 봉을 생성하기 위해 백엔드에서 500건 이상의 훨씬 더 많은 양의 체결 내역 조회가 요구되었습니다.
*   **조치 사항:**
    1.  **백엔드 조회 한도 확장:** `TradeRepository.java`에 `findTop50000BySymbolOrderByCreatedAtDesc` 쿼리를 추가 탑재하여 최대 50,000건의 최근 체결 데이터를 순식간에 fetch할 수 있도록 설정했습니다.
    2.  **StatsService 집계 알고리즘 보완:** 시간 범주가 넓은 봉 생성 시 `getCandleStats`에서 대용량 데이터를 메모리에 적재하여 주간/월간/연간 단위로 정확히 분할 및 집계(Time bucket grouping)하도록 구현하였습니다.
    3.  **다중 React 프론트엔드(`frontend-admin`, `frontend-user`, `frontend-react`) UI 동기화:** 차트 상단 탭에 `1W`, `1MO`, `1Y` 해상도 스위치 버튼을 일괄 탑재하고, TradingView Lightweight Chart 데이터 변환기(`TradingViewChart.tsx`) 내부 시간 필터 상수에 해당 해상도(주/월/년 단위 초)를 정의하여 캔들스틱과 거래량 바가 깨지지 않고 미려하게 오버레이 렌더링되도록 수정했습니다.
*   **효과:** 단기 1분 봉부터 초장기 연봉 차트까지 일관된 렉 없는 스무스한 전환을 보장하며, 정밀한 금융 분석이 가능한 수준 높은 거래 환경을 구축했습니다.

### 13. Promtail Ganache eth_blockNumber 로그 <no value> 렌더링 에러 복구 (🌟 신규)
*   **배경:** Ganache 컨테이너가 주기적으로 발행하는 `eth_blockNumber` JSON-RPC 로그를 그라파나 Loki 대시보드에 뿌려줄 때, Promtail Go 템플릿 단계에서 커스텀 파싱이 꼬여 한글 설명문 대신 `<no value>` 값이 화면에 렌더링되어 로그 가독성을 해치는 현상이 있었습니다.
*   **조치 사항:**
    1.  **Promtail 파이프라인 교정:** [promtail-config.yml](file:///c:/git/exchange_be/grafana/promtail-config.yml)의 파이프라인 단계에 `docker: {}` JSON/Docker 파서를 도입하여 로그의 엔트리를 명확하게 추출하게 했습니다.
    2.  **Entry 변수 참조 최적화:** 템플릿의 타겟 변수를 유실 가능한 사용자 정의 필드 대신, Promtail이 보장하는 최상위 원시 Entry 변수인 `.Entry`로 지정하여 예외 발생 없이 "Ganache 블록 번호 업데이트 감시용" 등의 한글 설명 메타데이터를 안정적으로 바인딩하고 출력하게 보완했습니다.
*   **효과:** 그라파나 대시보드 로그 모니터링 시 간헐적으로 발생하던 `<no value>` 에러가 완전히 박멸되어, 어드민이 안심하고 100% 한글 설명이 달린 Ganache 시스템 및 네트워크 블록 변동 원장을 가시적으로 관찰할 수 있게 되었습니다.

### 14. 회원단 실시간 렌더링 60fps 극대화 및 웹소켓 성능 병목 최적화 (🌟 신규)
*   **배경:** 회원단(`frontend-user`) 화면에서 10단 호가창, 실시간 시세 차트, 체결 내역 등이 100ms 스로틀링 타이머 및 콘솔 로그 부하로 인해 끊겨 보이거나 멈추는 현상이 있었으며, 크롬 등 브라우저 탭이 백그라운드로 전환(Slow Client)될 때 Netty 게이트웨이(`ws-gateway`)가 버퍼가 꽉 찬 해당 세션을 일괄 전송 루프 내에서 처리하느라 엣지 등 다른 활성화된 세션의 전송까지 덩달아 지연시키는 전체 네트워크 병목 결함이 있었습니다.
*   **조치 사항:**
    *   **프론트엔드 최적화:** `useExchangeStore.ts` 의 업데이트 스로틀 주기를 `100ms`에서 `30ms`로 단축하여 실시간 60fps 반응성을 확보하고, 메인 스레드를 블로킹하던 웹소켓 `onmessage` 내의 과도한 `console.log` 디버그 출력을 일괄 제거했습니다. 또한, `TradingViewChart.tsx`에서 Zustand 스토어 구독 방식을 어드민과 동일하게 구조분해 할당(Destructuring) 방식으로 변경하여 가격 및 상태 변경 시 차트 캔들이 즉시 실시간 리렌더링되도록 동기화했습니다.
    *   **백엔드(ws-gateway) 최적화:** `WsBroadcaster.java` 에서 Netty의 `ChannelGroup` 일괄 전송 방식 대신 개별 채널을 순회하며 `c.isWritable()`을 사전에 검사하도록 수정했습니다. 이를 통해 쓰기 가능한 활성 채널에만 복제본(`retainedDuplicate()`)을 전송하고, 스로틀링 중인 느린 세션은 즉시 건너뛰는(Skip) 백프레셔(Backpressure) 방어 로직을 적용한 후 오리지널 버퍼는 사용 직후 `nettyBuf.release()`를 통해 즉시 회수하도록 메모리 누수를 원천 차단했습니다.
*   **효과:** 다중 브라우저(크롬, 엣지 등) 및 멀티 세션 환경에서 특정 탭이 백그라운드로 전환되어도 활성화되어 있는 거래 화면은 어떠한 간섭이나 성능 하락 없이 실시간 호가 및 체결 데이터를 물흐르듯 완벽히 60fps로 받아 렌더링할 수 있는 초고성능 관제 터미널을 완성했습니다.

---

## ⚙️ 실행 및 구동 환경 구성 (Environments)

### 🚀 1. 분산 마이크로서비스 및 모니터링 클러스터 가동 (Docker Compose)

HFX 플랫폼의 컨테이너 클러스터는 서비스 기동 의존성을 완벽하게 고려하여 최적화된 기동 순서를 갖추고 있습니다:
- **핵심 인프라 우선 기동:** `postgres` (Healthcheck 검증) 및 `ganache`가 가장 먼저 가동됩니다.
- **순차적 연쇄 기동:** 데이터베이스 상태가 Healthy해진 뒤, 어드민 백엔드(`admin-api`)와 데이터 정산 데몬(`db-persister`)이 자동으로 기동되어 커넥션 실패 오류를 완벽하게 차단합니다.
- **환경 프로파일 적용 (`SPRING_PROFILES_ACTIVE`):**
  * `admin-api` 서비스 기동 시, 환경 변수 `SPRING_PROFILES_ACTIVE=dev` 설정을 통해 컨테이너 개발 환경용 프로파일(`application-dev.yml`)이 활성화됩니다.
  * 로컬 환경 구동 시에는 기본적으로 `local` 프로파일(`application-local.yml`)이 활성화되어 호스트 DB 주소(`localhost:5432`)로 접속합니다.
  * 운영 환경 배포 시에는 `prod` 프로파일(`application-prod.yml`)이 실행되어 자동 DB 임시 DDL 조작 및 디폴트 패스워드 시딩 기능이 원천 차단됩니다.

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
2. 우측 상단 `API Host` 입력 부분에 관리자 백엔드 IP(`localhost:8181` 또는 WSL IP)가 바인딩되어 있는지 확인합니다.
3. **[대시보드]**, **[회원 통합 관리]**, **[지갑 및 자산 관리]**, **[현황 및 통계 분석]** 등의 모든 기능이 미려하게 상호작용하는지 활용해 보십시오.

### 📈 5. 그라파나 관제 센터 및 통합 로깅/모니터링 확인
1. [http://localhost:3000](http://localhost:3000) (기본 계정: `admin` / 패스워드: `admin`)에 접속합니다.
2. **실시간 메트릭 모니터링:** 왼쪽 메뉴 ➔ **`Dashboards`** 로 이동하여 자동으로 Provisioning되어 있는 **`Exchange Performance Dashboard`**를 클릭합니다.
   - BTC/ADA 엔진의 마이크로초 단위 Latency 추이와 실시간 TPS, 게이트웨이의 액티브 커넥션뿐만 아니라, **구글 cAdvisor 통합 수집을 통해 플랫폼 내 모든 마이크로서비스 컨테이너들의 실시간 CPU 및 RAM 점유율 통계**가 시계열 그래프로 정밀하게 관측되는 모습을 확인합니다.
   - **`kafka-exporter`** 지표 스크랩을 기반으로 카프카의 실시간 파티션 수량 및 처리율 지표가 함께 노출됩니다.
3. **중앙집중형 로그 분석 (Loki):** 왼쪽 메뉴 ➔ **`Explore`** 탭을 클릭한 뒤, 데이터소스를 **`Loki`**로 선택합니다.
   - 쿼리 빌더 또는 `Line 필터`를 사용하여 `container="admin-api"` 등의 조건으로 원하는 서비스의 실시간 로그(`JAFTokenService`, `WalletDaemonService` 등)를 한눈에 모니터링하고 분석할 수 있습니다.
4. **Swagger API 테스트:** 어드민 API 명세서 확인 및 즉각적인 테스트는 [http://localhost:8181/swagger-ui/index.html](http://localhost:8181/swagger-ui/index.html)에 접속하여 가능합니다.


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

### 🌌 7. 현대식 React + TypeScript 고성능 실시간 서비스 구동 환경 (🌟 신규)
기존 바닐라 프런트엔드(`frontend` 폴더)와 통합 React 프로젝트(`frontend-react`)를 보존한 채, 회원 거래소 전용(`frontend-user`, 포트 5173)과 어드민 콘솔 전용(`frontend-admin`, 포트 5174)으로 분리 구축하였습니다. 기존 `frontend-react`는 정상 대조군 테스트를 마친 후 안전하게 정리하셔도 좋습니다.

1. **폴더 및 도구 정보:**
   * **회원 거래소 폴더:** [frontend-user](./frontend-user) (포트: `5173`)
   * **어드민 콘솔 폴더:** [frontend-admin](./frontend-admin) (포트: `5174`)
   * **기존 통합 폴더:** [frontend-react](./frontend-react) (임시 보존)
   * **환경:** Node.js v22.12.0 이상 (로컬 샌드박스 `./node-env`에 완전히 포함 배포)
   * **기술 스택:** React 19, Vite 8, TypeScript 6, Zustand, Lightweight-Charts, Lucide React

2. **주요 아키텍처 특장점:**
   * **Zustand 실시간 바이너리 인프라:** Netty WebSocket Gateway가 초당 수천 번 송출하는 32바이트 Big-Endian 바이너리 구조체를 고속 디코딩하여 스토어 상태(`lastPrice`, `tradesLog`, `totalTradesCount`)에 정밀 바인딩합니다.
   * **TradingViewChart 컴포넌트화:** 이중 시간 보장 안전 필터(Outdated Tick Guard)와 하이브리드 보정 패딩 엔진을 React의 Hook 구조(`useRef`, `useEffect`)로 모듈화하여, 전환 지연 레이턴시가 0인 고유의 퍼플 미학 차트 환경을 완비했습니다.
   * **DevOps 환경변수 오버라이드 지원:** 런타임에 `/config.json` 파일을 비동기 펫칭하여 인프라 API 엔드포인트를 무중단 갱신하고, 부재 시 로컬 환경으로 자동 폴백되는 프로덕션용 인젝션 설계를 지원합니다.
   * **JWT + RTR 기반 무상태 통합 보안 인증 및 Glassmorphism UI (🌟 신규):**
      - **무중단 토큰 교체:** Zustand 전역 상태 관리를 기반으로 작동하는 `fetchWithAuth` 인터셉터가 모든 API 통신을 안전하게 수행합니다. Access Token 만료에 따른 `401/403` 에러 감지 시, 프론트 백그라운드 단에서 백엔드 `/admin/auth/refresh` 경로를 타서 토큰을 즉시 교체 및 재시도하는 무중단 **RTR(Refresh Token Rotation)** 체계를 완비했습니다.
      - **초현대식 Glassmorphism 로그인:** 미인증 상태로 접속 시 전체 관제 화면을 완전히 숨기고, 고급스러운 백드롭 블러(Backdrop Blur)와 우주 성운 형상의 네온 보라빛 발광 그라데이션이 감도는 프리미엄 글래스모피즘 어드민 보안 콘솔 로그인 화면으로 자동 리다이렉트합니다.
      - **빠른 시드 로그인 배지 및 세션 로그아웃:** 로그인 화면에 기본 어드민 자격 증명(`admin@javaf.net` / `admin123`) 배지를 표시하여 원클릭 편의성을 더했으며, 상단 헤더 우측 영역에 로그인 상태 표출 및 원클릭 로그아웃 연동 버튼을 마운트하여 기기 세션을 실시간으로 안전하게 무효화합니다.
      - **실시간 스트리밍 일시정지 (Default OFF):** 어드민 대시보드 및 실시간 마켓 감시 탭에서 초당 수백 수천 개의 패킷 렌더링에 따른 브라우저 성능 오버헤드를 방지하기 위해 실시간 감시 일시정지(Pause) 및 재개 기능을 제공합니다. 진입 시 기본 비활성화(Default OFF) 상태로 시작하여 무분별한 DOM 업데이트를 방지합니다.
      - **시스템 환경 설정 메뉴 분리:** 기존 종합 대시보드 하단에 배치되어 있던 시스템 보안 및 환경 설정을 별도의 독자적인 **"시스템 환경 설정"** 메뉴(사이드바)로 독립 분리하였습니다. 전용 설정 페이지에서 중복 로그인 차단(Enforce Single Session) 실시간 ON/OFF 스위칭 제어는 물론, **모의 입금 시뮬레이션(Mock Deposit Simulation) 및 실시간 온체인 JAF 자동 입금 시뮬레이션(Real-time JAF Simulation) 독립 제어**, 실시간 알림음 재생 여부, 시스템 이상 긴급 메일 알림, 매칭 엔진 체결 규칙(FIFO/LIFO), 거래소 점검 모드 등 거래소 전체 운영 정책을 한눈에 파악하고 통제할 수 있는 프리미엄 환경 설정 센터를 구축했습니다.
      - **온체인 가상 지갑 & 커스터디(Custody) 자산 연동 및 시뮬레이션 시스템 (🌟 신규):**
        - **온체인 입출금 관리(Custody) 탭:** 어드민 사이드바에 단독 메뉴를 구축하여 거래소 시스템의 핫월렛(System Hot Wallet) 잔고 감시 및 원클릭 리밸런싱(자산 공급), 회원들의 온체인 입금용 지갑 주소 DB 조회, 실시간 입금 컨펌 진행 상황 모니터링, 출금 승인/반려 대기열 제어 및 모의 출금 요청 기능을 통합 제공합니다.
        - **블록체인 백그라운드 시뮬레이션 데몬:** 백엔드(`admin-api`)의 `WalletDaemonService`가 5초마다 동작하며 가상 블록체인 네트워크의 블록 높이(Block Height)를 관리하고, 입출금 트랜잭션의 블록 승인(Confirmations) 과정을 모사하여 최종 정산 처리를 수행합니다. 본 데몬은 시스템 설정의 **이중 스위치**에 의해 가동 범위가 독립적으로 제어됩니다:
          - **모의 입금 시뮬레이션 활성화 (Mock Deposit Simulation):** 비활성화 시 5초 주기 백그라운드 가상 입금(BTC, ETH, ADA 등 무작위) 자동 생성 기능이 중지됩니다. (실물 JAF 온체인 테스트 입금 및 출금 처리는 정상 작동합니다)
          - **실시간 온체인 JAF 자동 입금 시뮬레이션 활성화 (Real-time JAF Simulation):** 비활성화 시 5초 주기 백그라운드 JAF 온체인 자동 입금 시뮬레이션 전송이 중지됩니다. (수동 '테스트 입금 발생' 및 실제 온체인 블록체인 입금 감지 스캐너는 정상 작동합니다)
        - **블록 컨펌 수 동적 조절 설정:** 시스템 환경 설정 메뉴 내부에 **"온체인 블록 컨펌 수 설정"** 카드를 탑재하여, 어드민이 BTC, ETH, ADA 각 코인별 입금 확정에 요구되는 최소 블록 컨펌 수를 직접 동적으로 입력/수정하여 데이터베이스와 무중단 동기화할 수 있도록 구현했습니다.


3. **신규 컴퓨터(윈도우/WSL)에서의 초기 구동 환경 설정 가이드:**
   * **윈도우 네이티브 환경:** 
     * 컴퓨터에 이미 Node.js (v22 LTS 권장)가 설치되어 있는 경우, `node-env` 없이 즉시 윈도우 쉘에서 패키지 복원 및 실행이 가능합니다.
     ```cmd
     cd frontend-react
     npm install
     npm run dev
     ```
   * **WSL (리눅스) 환경 (추천):**
     * `node-env` 디렉토리가 `.gitignore`에 의해 제외되어 있으므로, WSL 환경에서 최초 기동 시 아래 **5초 세팅 커맨드**를 단 한 번만 실행하면 시스템 전역 설치 없이 로컬 샌드박스로 Node v22 환경이 즉시 구축됩니다.
     ```bash
     # 프로젝트 루트 폴더에서 실행
     mkdir -p node-env && curl -sL https://nodejs.org/dist/v22.13.0/node-v22.13.0-linux-x64.tar.xz | tar -xJ --strip-components=1 -C node-env
     ```
     * **로컬 샌드박스 Node.js 사용을 위한 PATH 설정 (중요):**
       WSL(리눅스) 환경에서는 시스템 전역 `npm` 대신 로컬 샌드박스(`node-env/bin`)를 사용하도록 `PATH` 환경 변수를 등록해야 합니다. 현재 터미널 세션에 로컬 Node/NPM을 등록하려면 아래 명령어를 실행하십시오:
       ```bash
       # 프로젝트 루트 폴더에서 실행 시:
       export PATH="$PWD/node-env/bin:$PATH"

       # 또는 하위 폴더(예: frontend-admin)에서 실행 시 절대 경로 사용:
       export PATH="/home/administrator/exchange_be/node-env/bin:$PATH"
       ```

   * **Docker Desktop (Windows/macOS) 환경 (무설치 초간편 기동):**
     * 로컬 PC에 Node.js나 리눅스 샌드박스 환경을 구축하지 않고 즉시 기동하고자 하는 경우, `docker-compose.yml` 클러스터에 완전 통합된 `frontend-react` 컨테이너를 활용합니다.
     ```cmd
     # 프로젝트 루트에서 React 서비스를 포함해 전체 마이크로서비스 기동
     docker compose up --build -d

     # 또는 React 서비스만 단독으로 기동
     docker compose up --build -d frontend-react
     ```

4. **로컬 개발 서버 구동 방법 (Windows 및 WSL 공통):**
   * **로컬 샌드박스(`node-env`)를 사용하는 WSL/리눅스 환경의 경우:**
     먼저 터미널에 `export PATH="/home/administrator/exchange_be/node-env/bin:$PATH"`를 실행하여 로컬 node와 npm을 로드할 수 있도록 준비한 후 각 디렉토리에서 패키지 설치 및 실행을 수행합니다.
     
     **회원 거래소 (`frontend-user` - http://localhost:5173) 실행:**
     ```bash
     cd frontend-user
     npm install
     npm run dev
     ```
     
     **어드민 콘솔 (`frontend-admin` - http://localhost:5174) 실행:**
     ```bash
     cd frontend-admin
     npm install
     npm run dev
     ```

   * **전역 Node.js가 설치되어 있는 윈도우/리눅스 환경의 경우:**
     별도의 `export` 과정 없이 각 디렉토리로 이동하여 실행합니다.
     
     **회원 거래소 실행:**
     ```bash
     cd frontend-user && npm install && npm run dev
     ```
     
     **어드민 콘솔 실행:**
     ```bash
     cd frontend-admin && npm install && npm run dev
     ```

5. **프로덕션 빌드 번들링 생성:**
   * **로컬 샌드박스(`node-env`)를 사용하는 WSL/리눅스 환경의 경우:**
     ```bash
     # PATH 등록 후 빌드 수행
     export PATH="/home/administrator/exchange_be/node-env/bin:$PATH"
     
     # 회원 거래소 빌드
     cd frontend-user && npm run build
     
     # 어드민 콘솔 빌드
     cd frontend-admin && npm run build
     ```
   * **전역 Node.js가 설치되어 있는 윈도우/리눅스 환경의 경우:**
     ```bash
     # 회원 거래소 빌드
     cd frontend-user && npm run build
     
     # 어드민 콘솔 빌드
     cd frontend-admin && npm run build
     ```
   독립적으로 컴파일이 완료된 `dist` 빌드 번들이 각각의 폴더 하위에 생성됩니다.

