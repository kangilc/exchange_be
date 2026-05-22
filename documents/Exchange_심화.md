아래는 요청하신 **4가지 주제**를  
👉 **실제 거래소(증권/코인)에서 쓰이는 정석 설계 기준**으로  
👉 **앞에서 설명한 전체 아키텍처와 자연스럽게 이어지도록**  
👉 **순서대로, 깊이 있게** 설명한 내용입니다.

***

# 1️⃣ 매칭 엔진 내부 알고리즘

## (가격 우선 / 시간 우선 · Price–Time Priority)

***

## 1.1 매칭 엔진의 기본 원칙

거래소 매칭 엔진은 단순합니다. 단 **절대 깨지면 안 되는 불변 규칙**이 있습니다.

### ✅ 핵심 불변 규칙

1.  **가격 우선 (Price Priority)**
2.  **시간 우선 (Time Priority)**

이 두 가지만 지켜져도 \*\*거래소의 공정성(Fairness)\*\*은 확보됩니다.

***

## 1.2 가격 우선 (Price Priority)

### 의미

*   **더 좋은 가격의 주문이 항상 먼저 체결**
*   매수(BUY): 높은 가격 우선
*   매도(SELL): 낮은 가격 우선

### 예시

    매수 호가
    65000 (A)
    64990 (B)

    → A가 항상 B보다 먼저 체결

👉 이게 깨지면 **시세 조작 / 프론트러닝 문제**가 발생합니다.

***

## 1.3 시간 우선 (Time Priority)

### 의미

*   **같은 가격이면 먼저 들어온 주문이 먼저 체결**

### 예시

    BUY 65000
    - Order#1 (10:01:00)
    - Order#2 (10:01:05)

    → Order#1 이 항상 우선

👉 FIFO 보장

***

## 1.4 내부 자료구조 (실전 표준)

### Buy / Sell 분리

```text
BuyBook  : 가격 DESC
SellBook : 가격 ASC
```

### Java 기준 구조 예시

```text
TreeMap<Price, Queue<Order>>
```

*   TreeMap
    *   정렬 보장
*   Queue
    *   시간 우선(FIFO)

### 실제 매칭 루프 (개념)

    새 주문 도착
      ↓
    반대 사이드 최적 가격 조회
      ↓
    가격이 맞으면 체결
      ↓
    수량 소진 시까지 반복

***

## 1.5 왜 단일 스레드인가?

### 이유

*   **동시성 제어(cost)가 성능보다 비쌈**
*   lock-free 구조를 만들기 더 복잡
*   대신 → **종목 단위 병렬화**

```text
BTC-USD 엔진 (Thread 1)
ETH-USD 엔진 (Thread 2)
```

👉 이것이 실거래소 방식입니다.

***

# 2️⃣ Kafka 파티션 전략 상세

***

## 2.1 왜 Kafka가 필수인가?

거래소에서는:

*   매칭
*   UI
*   차트
*   통계
*   감사

👉 **하나의 이벤트를 여러 소비자가 동시에** 가져가야 합니다.

Kafka는:

*   순서 보장
*   fan-out
*   replay

을 동시에 만족합니다.

***

## 2.2 핵심 원칙: 파티션 = 순서 단위

### ✅ 절대 법칙

> **Kafka 파티션 안에서만 순서가 보장된다**

***

## 2.3 정석 파티션 설계

### ✅ 방법 A (가장 일반적)

    Topic: orderbook-events
    Partition Key: symbol

예:

    BTC-USD → Partition 0
    ETH-USD → Partition 1

👉 종목별 순서 100% 보장

***

### ❌ 잘못된 설계

| 설계                | 문제     |
| ----------------- | ------ |
| partition=orderId | 순서 깨짐  |
| random key        | 상태 불일치 |
| partition=price   | 부분 뒤섞임 |

***

## 2.4 이벤트 폭주 대비

### 전략

*   파티션은 **종목 수 이상**
*   인기 종목은 **샤딩(symbol-subkey)**

```text
BTC-USD-0
BTC-USD-1
```

👉 이후 **Market Data Service에서 재조합**

***

# 3️⃣ WebSocket 확장 시 세션 동기화

***

## 3.1 WebSocket의 난제

WebSocket은:

*   상태 연결
*   서버 메모리 점유

문제:

> **서버가 여러 대면, 연결 정보가 분산됨**

***

## 3.2 기본 구조 (문제 발생)

```text
Client A → WS Server 1
Client B → WS Server 2
```

이 상태에서:

*   BTC 가격 변동 발생

👉 **모든 서버가 동일한 이벤트를 알아야 함**

***

## 3.3 정석 해결책 ①

### Kafka Fan-out

    Kafka → 모든 WS 서버가 Consumer

*   WS 서버는 **Stateless**
*   자신에게 연결된 클라이언트에게만 push

✅ 가장 많이 쓰는 방식

***

## 3.4 정석 해결책 ②

### Redis Pub/Sub (보조)

    Matching → Kafka
    Kafka → Market Data
    Market Data → Redis PubSub
    Redis → WS Server

*   WS 서버 scale-out 용이
*   latency 매우 낮음

***

## 3.5 WebSocket 메시지 흐름

    Client Subscribe
      ↓
    WS Server 등록
      ↓
    Kafka Event 도착
      ↓
    해당 종목 구독 Client에게만 Broadcast

👉 **브로드캐스트가 아니라 “구독 단위 push”**

***

# 4️⃣ 실거래소 수준 Race Condition 방지

이 부분이 **가장 중요**합니다.

***

## 4.1 발생 가능한 Race Condition

| 상황     | 문제     |
| ------ | ------ |
| 동시 주문  | 체결 중복  |
| 중복 이벤트 | 상태 불일치 |
| 재시도    | 이중 반영  |

***

## 4.2 매칭 엔진에서의 해결 (1차 방어선)

### ✅ 단일 쓰레드 불변식

*   한 종목 = 한 쓰레드
*   동일 Book에 동시 접근 ❌

👉 이 한 가지로 **80% 해결**

***

## 4.3 Kafka 레벨에서의 해결 (2차 방어선)

### ✅ Exactly-once 대신 Idempotency

> 실거래소는 **Exactly Once를 거의 쓰지 않음**

대신:

```text
eventId(UUID)
```

*   이미 처리된 eventId는 무시

***

## 4.4 Market Data / UI 레벨 방어 (3차)

### ✅ sequence number

```json
{
  "symbol": "BTC-USD",
  "seq": 102938,
  "delta": ...
}
```

UI는:

*   seq 역전 → 무시
*   seq 누락 → Snapshot 재요청

***

## 4.5 재기동 시 상태 복구

### 전략

1.  Kafka replay
2.  최신 Snapshot 로딩
3.  이후 Delta 적용

👉 **중단 후 일관성 복구 가능**

***

# ✅ 전체 요약 (한 문장으로)

> **실거래소는  
> 단일 스레드 매칭 엔진 + 종목 단위 Kafka 파티션 +  
> Stateless WebSocket Gateway +  
> Idempotent 이벤트 처리로  
> 공정성과 실시간성을 동시에 보장한다.**

***

## 📌 지금 구조와의 연결

당신의 현재 스택과 **완벽히 맞습니다**:

*   ✅ Spring / JVM
*   ✅ Kafka 경험
*   ✅ WebSocket / SSE 이해
*   ✅ Redis / Cache 경험

***

## 🔜 다음 심화 주제 (원하시면)

*   매칭 엔진 코드 수준 pseudo / skeleton
*   OrderBook 압축/Delta 스키마 설계
*   초고빈도 종목(scale-out) 전략
*   클러스터 장애 시 Failover 구조

👉 **어디까지 실제 구현 수위를 끌어올릴지** 말씀 주세요.
