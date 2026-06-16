# 🌌 Java Matching Engine Core (`engine-core`)

순수 자바(Java) 표준 라이브러리만 사용해 작성한 초저지연(Low-Latency) 체결 매칭 엔진이다.

---

## 🏗️ 구성 요소

### 1. `exchange.engine.core`
* **`EngineRunner`**: 메인 진입점. 주문 수신용 TCP 명령어 서버와 이벤트 전송용 TCP 브로드캐스터 서버를 구동한다.
* **`MatchingEngine`**: 주문 큐(`BlockingQueue`)에서 명령을 꺼내 호가창을 매칭하고 이벤트를 방출하는 메인 루프 스레드다.
* **`MetricsServer`**: 프로메테우스 메트릭(`/metrics`) 및 실시간 호가창 스냅샷(`/snapshot`)을 서빙하는 내장 HTTP 서버다.
* **`ConfigLoader`**: 시스템 속성, 환경 변수, 로컬 설정 파일(`.env.<profile>`)을 순서대로 로드한다.

### 2. `exchange.engine.book`
* **`OrderBook`**: 매수(`bids`, TreeMap 내림차순 정렬)와 매도(`asks`, TreeMap 오름차순 정렬) 호가창을 관리한다. 같은 가격대는 `ArrayDeque`로 시간 순서대로 처리한다.

### 3. `exchange.engine.command`
* **`Command`**: 매칭 엔진 입력 명령어 프로토콜 (`NewOrderCmd` / `CancelOrderCmd`).

### 4. `exchange.engine.domain`
* **`Order`** / **`Side`** / **`Trade`**: 주문, 주문 방향, 체결 결과를 정의하는 데이터 모델이다.

### 5. `exchange.engine.event`
* **`EventOutbox`**: 엔진에서 발생한 이벤트(`ACCEPT`, `DELTA`, `TRADE`, `CANCEL`)를 외부로 밀어내는 인터페이스다.

---

## 🔌 네트워크 포트

| 환경 변수명 | 포트 | 프로토콜 | 설명 |
|---|---|---|---|
| `COMMAND_PORT` | `9999` | TCP | 주문 및 취소 명령 접수 포트 |
| `ENGINE_PORT` | `9998` | TCP | 매칭 이벤트 브로드캐스트 스트리밍 포트 |
| `METRICS_PORT` | `9100` | HTTP | 메트릭 및 호가 스냅샷 포트 |

---

## 🛠️ 빌드 및 실행

### 1. 빌드
```bash
./gradlew :engine-core:build
```

### 2. 실행
```bash
java -jar engine-core/build/libs/engine-core.jar
```
또는
```bash
./gradlew :engine-core:run
```
