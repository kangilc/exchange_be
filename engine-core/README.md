# 🌌 Java Matching Engine Core (`engine-core`)

이 모듈은 외부 종속성 없이 순수 자바(Java) 표준 라이브러리만을 활용하여 작성된 **초저지연(Low-Latency) 고성능 거래소 체결 매칭 엔진**입니다.

---

## 🏗️ 아키텍처 및 주요 구성 요소

엔진 코어는 메모리상에서 모든 오더(주문)를 관리하고 정밀하게 매칭할 수 있도록 다음과 같이 역할이 분리되어 설계되었습니다:

### 1. `exchange.engine.core` (핵심 라이프사이클 및 설정)
* **`EngineRunner`**: 애플리케이션의 메인 진입점입니다. 외부 주문 접수를 수신할 TCP 명령어 서버와 매칭 이벤트를 다중 수신인에게 실시간 전송할 TCP 브로드캐스터 서버를 시작합니다.
* **`MatchingEngine`**: 주문 대기열(`BlockingQueue`)로부터 명령어를 순차적으로 가져와 오더북 내의 반대 호가와 일치시켜 거래를 매칭하고 이벤트를 방출하는 메인 스레드 프로세스입니다.
* **`MetricsServer`**: 메트릭 서버 동작 여부에 따라 프로메테우스 포맷의 성능 지표(`/metrics`)와 프론트엔드용 실시간 오더북 호가창 상태 스냅샷(`/snapshot`) 데이터를 제공하는 초경량 내장 HTTP 서버입니다.
* **`ConfigLoader`**: 활성화된 환경 프로필(`dev`, `prod` 등)에 따라 시스템 속성, 환경 변수 및 로컬 프로필 설정 파일(`.env.<profile>`)을 순서대로 로드하는 유틸리티 클래스입니다.

### 2. `exchange.engine.book` (주문 원장 관리)
* **`OrderBook`**: 매수 호가창(`bids`)과 매도 호가창(`asks`)을 관리하는 메모리상 메모리 원장입니다.
  * 가격 우선 순위(Price Priority) 정렬을 위해 매수는 내림차순, 매도는 오름차순의 `TreeMap(NavigableMap)`으로 구성되어 있습니다.
  * 시간 우선 순위(Time Priority) 처리를 위해 각 가격 호가대 하위의 주문들은 `ArrayDeque` 큐 구조로 관리됩니다.

### 3. `exchange.engine.command` (입력 프로토콜)
* **`Command`**: 매칭 엔진이 수신하는 모든 명령어의 상위 sealed 인터페이스입니다.
  * `NewOrderCmd`: 신규 주문을 호가창에 넣거나 체결을 시도합니다.
  * `CancelOrderCmd`: 대기 중인 활성 주문을 제거하고 잔량을 환불합니다.

### 4. `exchange.engine.domain` (데이터 모델)
* **`Order`**: 주문의 상세 정보(주문ID, 사용자ID, 매수/매도 방향, 가격, 남은수량, 타임스탬프)를 저장하는 모델입니다.
* **`Side`**: 주문의 방향인 `BUY` 및 `SELL`을 구분하는 열거형(Enum)입니다.
* **`Trade`**: 체결 성사 시 생성되는 두 주문(Taker, Maker) 간의 거래 매칭 레코드 모델입니다.

### 5. `exchange.engine.event` (출력 프로토콜)
* **`EventOutbox`**: 엔진 내부에서 발생한 오더 접수(`ACCEPT`), 호가 변화(`DELTA`), 거래 체결(`TRADE`), 주문 취소(`CANCEL`) 이벤트를 수신하는 아웃박스 인터페이스입니다.

---

## 🔌 네트워크 포트 정보

| 환경 변수명 | 기본 포트 | 프로토콜 | 설명 |
|---|---|---|---|
| `COMMAND_PORT` | `9999` | TCP | 신규 주문(NEW) 및 주문 취소(CANCEL) 명령어를 접수받는 소켓 포트 |
| `ENGINE_PORT` | `9998` | TCP | 발생한 체결 및 변경 이벤트를 실시간으로 구독자들에게 스트리밍하는 브로드캐스터 포트 |
| `METRICS_PORT` | `9100` | HTTP | 프로메테우스 성능 모니터링 메트릭 및 오더북 스냅샷을 서빙하는 HTTP 포트 |

---

## 🛠️ 빌드 및 실행 방법

### 1. 빌드 (Gradle)
외부 종속성 없이 순수 자바 코드만을 컴파일하여 배포 가능한 Jar 아티팩트를 빌드합니다.
```bash
./gradlew :engine-core:build
```

### 2. 단독 실행
```bash
java -jar engine-core/build/libs/engine-core.jar
```
또는 Gradle application 플러그인을 활용해 바로 실행할 수도 있습니다:
```bash
./gradlew :engine-core:run
```
