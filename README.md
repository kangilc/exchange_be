# 🌌 JavaF Exchange (HF-X)

초저지연(Ultra-Low Latency) 인메모리 가격-시간 우선(FIFO) 매칭 엔진, 실시간 시세 분배 웹소켓 게이트웨이, 초고속 오프라인 백테스팅 프레임워크를 갖춘 차세대 암호화폐/증권 거래소 백엔드 플랫폼. 

최근 **비동기 이벤트 소싱(Event Sourcing) 기반 PostgreSQL 실시간 자산 정산(Settle) 파이프라인**, **Upbit 스타일의 고대비 다크 테마 터미널(JavaF)**, **ADA-KRW 멀티 심볼 병렬 확장**, **진짜 RTT 네트워크 지연 실측**, **rAF 기반 호가창 렌더링 스로틀링**, **Prometheus & Grafana 기반 0-의존성 초경량 성능 계측 체계**, 그리고 **Spring Boot 기반 통합 어드민 API & 어드민 대시보드 콘솔**이 추가 완비됨.

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
    UI[JavaF Premium HTML5 UI] <-->|32-byte Binary Stream / PING-PONG| WS[Netty WS Gateway: 8080]
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

| 서비스명 (Service) | 역할 (Role) | 호스트 외부 포트 (Host Port) | 컨테이너 내부 포트 (Container Port) | 맵핑 유형 & 비고 (Notes) |
| :--- | :--- | :--- | :--- | :--- |
| **`ws-gateway`** | 실시간 웹소켓 시세/주문 게이트웨이 | **`8080`**<br>`9102` | **`8080`**<br>`9102` | **주요 접속 서비스 포트**.<br>자체 프로메테우스 메트릭 노출 포트 포함. |
| **`admin-api`** | Spring Boot 통합 어드민 백엔드 | **`8081`** | **`8081`** | 어드민 대시보드 연동용 REST API 포트. |
| **`cadvisor`** | 실시간 컨테이너 리소스 계측 에이전트 | **`8082`** | **`8080`** | ⚠️ **포트 충돌 방지 회피 설계**:<br>내부 포트는 `8080`으로 고정이지만, 호스트의 `8080`이 `ws-gateway`에 의해 점유되어 있으므로 호스트 외부 포트를 **`8082`**로 우회 매핑하였습니다. |
| **`postgres`** | 회원/자산/정산 관계형 데이터베이스 | **`5432`** | **`5432`** | 데이터베이스 단독 포트 바인딩. |
| **`prometheus`** | 분산 메트릭 수집 및 시계열 DB | **`9090`** | **`9090`** | 프로메테우스 웹 콘솔 접속 포트. |
| **`grafana`** | 실시간 계측 시각화 대시보드 | **`3000`** | **`3000`** | 그라파나 대시보드 웹 UI 접속 포트 (ID/PW: admin/admin). |
| **`engine-btc`** | BTC-USD 매칭 엔진 (인메모리 코어) | **`9999`**<br>`9998`<br>`9100` | **`9999`**<br>`9998`<br>`9100` | TCP 커맨드 수신 (9999)<br>TCP 체결 이벤트 송신 (9998)<br>프로메테우스 메트릭 (9100) |
| **`engine-ada`** | ADA-KRW 매칭 엔진 (인메모리 코어) | **`9997`**<br>`9996`<br>`9101` | **`9997`**<br>`9996`<br>`9101` | TCP 커맨드 수신 (9997)<br>TCP 체결 이벤트 송신 (9996)<br>프로메테우스 메트릭 (9101) |
| **`kafka`** | 분산 실시간 메시지 브로커 | **`29092`**<br>`9092` | **`29092`**<br>`9092` | 외부 개발기 접속용 (29092)<br>컨테이너 내부 브릿지용 (9092) |
| **`zookeeper`** | 카프카 메타데이터 제어/조율 관리자 | **`2181`** | **`2181`** | 카프카 클러스터 내부 조율용. |

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

### 💻 3. 실시간 업비트 스타일 거래 터미널 접속
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
