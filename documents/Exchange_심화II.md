좋습니다.  
아래는 요청하신 **4가지 주제**를 **실거래소 기준으로 “코드·스키마·아키텍처 관점”에서**  
👉 **앞에서 설명한 구조와 정확히 맞물리도록**  
👉 **처음부터 끝까지 순서대로** 정리한 답변입니다.

***

# 1️⃣ 매칭 엔진 코드 수준 Pseudo / Skeleton

> 목표: **가격 우선 → 시간 우선**을 깨지지 않게 보장하면서  
> **Race Condition 없이 초고속 매칭**

***

## 1.1 기본 구조 (1종목 = 1엔진 = 1스레드)

```java
class MatchingEngine implements Runnable {

    private final String symbol;
    private final OrderBook orderBook;
    private final BlockingQueue<OrderCommand> queue;

    public void run() {
        while (true) {
            OrderCommand cmd = queue.take();
            handle(cmd);
        }
    }
}
```

### 핵심

*   **동시성 제어 ❌** (락 없음)
*   **큐 + 단일 스레드 = 절대적 순서 보장**

***

## 1.2 OrderBook 구조 (Price-Time Priority)

```java
class OrderBook {
    NavigableMap<BigDecimal, Deque<Order>> bids; // DESC
    NavigableMap<BigDecimal, Deque<Order>> asks; // ASC
}
```

*   `Price → Queue<Order>`
*   Queue = FIFO → **시간 우선**

***

## 1.3 주문 처리 루프 (Pseudo)

```java
void handle(NewOrder order) {
    if (order.isBuy()) {
        matchBuy(order);
    } else {
        matchSell(order);
    }
}
```

```java
void matchBuy(Order buy) {
    while (buy.qty > 0) {
        BestAsk ask = orderBook.bestAsk();
        if (ask.price > buy.price) break;

        Trade trade = execute(buy, ask);
        emitTrade(trade);
        emitOrderBookDelta(ask.price, -trade.qty);
    }
}
```

✅ **가격 우선 → 시간 우선**이 자동으로 보장됨
1. 가격 우선 (Price Priority) 보장
orderBook.bestAsk(): 이 메서드가 항상 가장 낮은 가격(최우선 매도호가)을 먼저 반환하도록 설계되어 있습니다.
if (ask.price > buy.price) break;: 내가 사려는 가격(buy.price)보다 싼 물량이 있을 때만 루프가 돌기 때문에, 시장에서 가장 유리한 가격부터 차례대로 체결됩니다.
2. 시간 우선 (Time Priority) 보장
BestAsk ask 내부의 데이터 구조(보통 Queue) 덕분입니다. 동일한 가격의 매도 주문들이 있다면, orderBook은 그중 먼저 들어온 주문을 bestAsk로 먼저 내보냅니다.
while 루프는 그 순서대로 하나씩 꺼내어 execute를 호출하므로 자연스럽게 시간 순서가 지켜집니다.
3. 실무적 고려사항 (Tip)
이 루프를 실제 시스템으로 확장할 때 보통 다음 두 가지를 추가로 처리합니다.
부분 체결 (Partial Fill): ask.qty가 buy.qty보다 클 경우, ask 주문의 잔량을 업데이트하고 루프를 종료하는 처리가 execute 내부에 포함되어야 합니다.
완전 체결 시 제거: ask.qty를 모두 소모하면 해당 주문을 호가창(Order Book)에서 완전히 삭제하는 로직이 뒤따릅니다.

***

## 1.4 반드시 지켜야 할 불변식

*   하나의 OrderBook은 **절대 동시에 접근하지 않는다**
*   DB ✅❌ **절대 쓰지 않는다**
*   Kafka 생산자는 **엔진 바깥이 아닌, 엔진 내부에서 실행**
1. 싱글 스레드 모델 (Single-threaded Execution)
"절대 동시에 접근하지 않는다": Lock이나 Mutex를 사용하면 컨텍스트 스위칭 오버헤드와 경합(Contention)으로 인해 지연 시간이 급격히 증가합니다.
해결책: 매칭 엔진을 단일 스레드에서 순차적으로 실행(Sequential Execution)하게 하여 원자성(Atomicity)을 100% 보장하고 데이터 일관성 문제를 원천 차단합니다.
2. No-DB (In-Memory Processing)
"절대 쓰지 않는다": 주문 한 건을 처리할 때마다 DB에 IO를 발생시키면 초당 수만~수십만 건(TPS)의 처리가 불가능합니다.
해결책: 모든 호가창 데이터는 100% 메모리(In-Memory)에 유지합니다. 영속성은 DB 대신 이벤트 소싱(Event Sourcing)이나 스냅샷 + 리플레이 방식으로 해결합니다.
3. 내부 Kafka 생산자 (Deterministic Output)
"엔진 내부에서 실행": 엔진 외부에서 비동기로 이벤트를 처리하면 '체결 순서'와 '통보 순서'가 뒤섞일 위험이 있습니다.
해결책: 엔진이 매칭을 완료한 즉시 내부에서 순서대로 메시지를 발행(Emit)해야만 시스템 전체의 결정론적 상태(Deterministic State)를 유지할 수 있습니다. 즉, 엔진이 A→B 순서로 체결했다면 외부 세상도 반드시 A→B 순서로 알아야 합니다.
***

# 2️⃣ OrderBook 압축 / Delta 스키마 설계

> UI에서 **전체 오더북 재전송은 절대 금물**

***

## 2.1 왜 Delta가 필수인가?

| 방식               | 문제       |
| ---------------- | -------- |
| Full Snapshot 매번 | 트래픽 폭발   |
| Delta 기반         | ✅ 최소 데이터 |

***

## 2.2 내부 상태 vs 외부 전송 포맷 구분

### 내부

```java
Map<Price, TotalQty>
```

### 외부 Kafka / WS

```json
DELTA Event
```
1. 내부 상태: Map<Price, TotalQty> (Aggregation)
엔진 메모리 내에서는 효율적인 조회를 위해 가격별로 물량을 합산해 관리합니다.
목적: 매칭 속도 극대화. 매칭 시 개별 주문을 일일이 뒤지는 게 아니라, 특정 가격대에 물량이 있는지 즉시 확인(O(1) 또는 O(log N))하기 위함입니다.
특징: TreeMap 등을 사용하여 가격 순으로 정렬된 상태를 유지하는 경우가 많습니다.
2. 외부 전송: DELTA Event (Incremental Update)
호가창 전체(Snapshot)를 매번 보내는 대신, 변경된 부분(차이점)만 보냅니다.
포맷 예시: {"price": 1500, "delta_qty": -100}
이점:
대역폭 절감: 수만 개의 호가 데이터 중 변한 것만 전송하므로 네트워크 부하가 획기적으로 줄어듭니다.
결정론적 동기화: 외부 시스템(UI, 데이터베이스 등)은 엔진이 보낸 이벤트를 순서대로 적용하기만 하면 엔진과 동일한 상태를 복제할 수 있습니다.
3. 실무적 핵심 (Update vs. Delete)
DELTA를 보낼 때 주의할 규칙이 하나 있습니다.
수량 > 0: 해당 가격대의 총 수량을 이 값으로 업데이트하거나 더함.
수량 = 0: 해당 가격대를 호가창에서 삭제(Remove).
***

## 2.3 Delta 이벤트 스키마 (정석)

```json
{
  "type": "ORDERBOOK_DELTA",
  "symbol": "BTC-USD",
  "side": "BUY",
  "price": "65000.0",
  "deltaQty": "-0.5",
  "seq": 102345,
  "ts": 1713160000123
}
```

### 필수 이유

*   `deltaQty = +/-`
*   `seq` → 순서 검증
*   `ts` → 동기화 기준
1. seq (Sequence Number): 데이터 무결성의 핵심
용도: 수신자(UI, API, DB)가 메시지 유실이나 순서 뒤바뀜을 감지하는 용도입니다.
규칙: 엔진 내부에서 1씩 증가하는 연속된 숫자를 부여합니다.
체크: 만약 102345 다음에 102347이 들어왔다면, 중간에 102346이 누락되었음을 즉시 알고 스냅샷을 재요청(Resync)할 수 있습니다.
2. deltaQty: 상태 변경의 명확성
음수(-0.5): 체결이나 취소로 인해 물량이 줄어듦을 뜻합니다.
양수(+1.2): 신규 주문으로 물량이 쌓임을 뜻합니다.
0 (Convention): 설계에 따라 다르지만, 보통 0은 해당 가격대의 물량이 완전히 사라졌음을 알리는 신호로 약속하여 사용하기도 합니다.
3. price & deltaQty (String Format)
부동 소수점 방지: JSON에서 숫자를 double로 처리하면 소수점 정밀도 문제(Rounding Error)가 발생할 수 있습니다. 따라서 금융권 스키마에서는 반드시 문자열(String)로 전송하여 정밀도를 보존합니다.
4. ts (Timestamp): 지연 시간(Latency) 측정
이벤트 발생 시점: 엔진이 매칭을 완료한 유닉스 타임스탬프입니다.
분석: 현재 시간 - ts를 계산하면 엔진에서 클라이언트까지 도달하는 데 걸린 실제 지연 시간을 모니터링할 수 있습니다.
***

## 2.4 Snapshot 이벤트 (초기/복구)

```json
{
  "type": "SNAPSHOT",
  "symbol": "BTC-USD",
  "bids": [[65000, 1.2], [64990, 0.8]],
  "asks": [[65010, 0.5], [65020, 1.0]],
  "seq": 102300
}
```

***

## 2.5 UI 적용 규칙 (중요)

*   `seq` 누락 / 역전 → **즉시 Snapshot 재요청**
*   Delta는 Snapshot 이후만 적용

***

# 3️⃣ 초고빈도 종목 Scale‑out 전략

> BTC‑USD 같은 **핫 종목은 단일 엔진으로는 한계**

***

## 3.1 기본 전략: Symbol‑Shard

```text
BTC-USD-0
BTC-USD-1
BTC-USD-2
```

*   주문은 **hash(orderId or userId)**
*   각 shard는 독립 엔진

***

## 3.2 오더북 분할 방식

| 방식                | 설명     |
| ----------------- | ------ |
| Price Range Shard | 가격 구간별 |
| Time Slice Shard  | 시간 기준  |
| ❌ User Shard      | 공정성 깨짐 |

✅ 대부분 **Price Range Shard** 사용

***

## 3.3 Market Data 재조합

```text
Shard A Δ
Shard B Δ
Shard C Δ
  ↓
Market Data Aggregator
  ↓
Unified OrderBook Stream
```

***

## 3.4 Kafka 파티션 전략

```text
Topic: orderbook-events-btc
Partitions: 3
Key: shardId
```

✅ 파티션 == 엔진 인스턴스

***

# 4️⃣ 클러스터 장애 시 Failover 구조

> 실거래소에서 **가장 중요한 부분**

***

## 4.1 장애 유형

| 장애       | 영향       |
| -------- | -------- |
| 엔진 죽음    | 거래 중단    |
| WS 서버 죽음 | UI 갱신 중단 |
| Kafka 장애 | 확산 위험    |

***

## 4.2 Matching Engine 장애 대응

### ✅ 기본 원칙

*   엔진 상태 = **Kafka 이벤트 로그 + Snapshot**

***

### 복구 시나리오

    1. 엔진 재기동
    2. 마지막 Snapshot 로딩
    3. Kafka offset부터 replay
    4. 상태 완전 복구

✅ 이벤트 소싱 패턴

***

## 4.3 WebSocket 서버 장애

*   WS 서버는 **Stateless**
*   재연결 시:
    *   최신 Snapshot 전달
    *   이후 Delta

👉 사용자 체감 무중단

***

## 4.4 중복 이벤트 방지 (Idempotency)

```text
eventId
or seq
```

*   이미 처리된 `seq` 이하 무시
*   **Exactly Once ❌**
*   **At Least Once + Idempotent ✅**

***

## 4.5 Split‑Brain 방지 (중요)

*   엔진 마스터는 **Zookeeper / Etcd / Redis Lock**
*   동시에 2개 엔진 활성 ❌

```text
BTC-USD master = engine-03
```

***

# ✅ 최종 핵심 정리

> **실거래소의 본질은 기술이 아니라 “불변식 유지”다**

### 반드시 지켜야 할 4대 원칙

1.  ✅ **단일 스레드 + 가격/시간 우선**
2.  ✅ **Delta 기반 이벤트 스트림**
3.  ✅ **Kafka로 순서·재처리 확보**
4.  ✅ **Snapshot + Replay로 장애 복구**

***

## ✅ 당신의 현재 스택 적합성

| 항목           | 적합 여부 |
| ------------ | ----- |
| Spring / JVM | ✅     |
| Kafka        | ✅✅    |
| Redis        | ✅     |
| WebSocket    | ✅     |
| ELK          | ✅     |

👉 **이미 70% 이상 준비된 상태**

***

## 🔜 다음 심화 주제 (선택)

원하시면 다음으로 바로 들어갈 수 있습니다:

*   🔥 실제 **엔진 코드 수준 Skeleton 구현**
*   🔥 오더북 메모리 최적화 전략
*   🔥 HFT(초저지연) 대응 JVM 튜닝
*   🔥 거래소 보안/프론트러닝 방지 설계

어디까지 **실제 구현 수준으로** 가보고 싶으신가요?
