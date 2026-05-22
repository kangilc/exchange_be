# 05. 매칭 엔진 심층 분석 (Matching Engine Deep Dive)

본 문서는 거래소의 핵심인 매칭 엔진의 내부 자료구조, 알고리즘 구현 및 성능 보장 전략을 상세히 설명합니다.

## 1. 핵심 설계 원칙
*   **Single-Threaded Execution:** 경합 조건(Race Condition)을 원천 차단하기 위해 1개 종목(Symbol)당 1개의 전용 스레드에서 모든 주문을 처리합니다.
*   **In-Memory Architecture:** 초저지연을 위해 모든 호가창(Orderbook) 데이터는 메모리에 유지하며, 외부 DB나 Redis와의 동기적 통신을 배제합니다.
*   **Price-Time Priority:** 가격이 유리한 주문을 우선하고, 동일 가격일 경우 먼저 접수된 주문을 우선 체결합니다.

## 2. 매칭 엔진 핵심 자료구조 (Orderbook)
Java의 `TreeMap`을 활용하여 가격대별로 주문을 정렬하고, 각 가격 레벨 내에서는 `ArrayDeque`를 사용하여 접수 순서(FIFO)를 보장합니다.

```java
import java.util.*;

/**
 * OrderBook
 *
 * 매수(BUY) / 매도(SELL) 주문을 가격 단위로 관리하는 오더북 구현체
 * - 가격 우선 (Price Priority)
 * - 동일 가격 내 시간 우선 (Time Priority, FIFO)
 * - 빠른 주문 조회/취소를 위한 보조 인덱스 유지
 */
public final class OrderBook {

    /**
     * 매수 오더북 (BIDS)
     * - Key   : 가격 (Long)
     * - Value : 해당 가격에 존재하는 매수 주문 큐 (FIFO)
     *
     * 정렬 기준:
     * - 높은 가격이 우선 체결되어야 하므로 내림차순 정렬
     */
    final NavigableMap<Long, ArrayDeque<Order>> bids =
            new TreeMap<>(Comparator.reverseOrder());

    /**
     * 매도 오더북 (ASKS)
     * - Key   : 가격 (Long)
     * - Value : 해당 가격에 존재하는 매도 주문 큐 (FIFO)
     *
     * 정렬 기준:
     * - 낮은 가격이 우선 체결되어야 하므로 오름차순 정렬
     */
    final NavigableMap<Long, ArrayDeque<Order>> asks =
            new TreeMap<>();

    /**
     * 주문 ID → Order 객체 매핑
     * - O(1) 주문 조회
     * - Cancel / Status 조회 시 사용
     */
    final Map<Long, Order> orderIndex = new HashMap<>();

    /**
     * 주문 ID → 가격 매핑
     * - Cancel 시 어떤 가격 레벨의 큐에서 제거해야 하는지 빠르게 찾기 위함
     */
    final Map<Long, Long> orderPriceIndex = new HashMap<>();

    /**
     * 신규 주문을 오더북에 추가
     *
     * @param o 주문 객체
     */
    public void add(Order o) {

        // 주문 방향에 따라 매수/매도 오더북 선택
        var book = (o.side == Side.BUY) ? bids : asks;

        // 가격 레벨이 없으면 새 큐 생성
        // 동일 가격 내에서는 FIFO 원칙을 위해 큐의 끝에 추가
        book.computeIfAbsent(o.price, k -> new ArrayDeque<>())
                .addLast(o);

        // 빠른 조회/취소 처리를 위해 보조 인덱스 저장
        orderIndex.put(o.orderId, o);
        orderPriceIndex.put(o.orderId, o.price);
    }

    /**
     * 주문 ID로 주문 조회
     *
     * @param orderId 주문 ID
     * @return Order 객체 (없으면 null)
     */
    public Order find(long orderId) {
        return orderIndex.get(orderId);
    }

    /**
     * 주문을 오더북에서 제거 (Cancel 처리)
     *
     * @param o 제거할 주문
     */
    public void remove(Order o) {

        // 주문 방향에 맞는 오더북 선택
        var book = (o.side == Side.BUY) ? bids : asks;

        // 주문 ID 기반으로 가격 레벨 조회
        Long price = orderPriceIndex.remove(o.orderId);

        // 전역 인덱스에서도 제거
        orderIndex.remove(o.orderId);

        // 이미 제거되었거나 존재하지 않는 주문
        if (price == null) return;

        // 해당 가격 레벨의 주문 큐 조회
        var q = book.get(price);
        if (q != null) {

            // 동일 가격 큐에서 해당 주문 제거
            // (Order 객체 자체를 저장하고 있으므로 orderId 비교)
            q.removeIf(x -> x.orderId == o.orderId);

            // 가격 레벨에 더 이상 주문이 없으면 맵에서도 제거
            if (q.isEmpty()) {
                book.remove(price);
            }
        }
    }
}
```

## 3. 매칭 알고리즘 구현 (Matching Engine)
새로운 주문이 들어오면 반대편 호가창의 최우선 호가와 매칭을 시도하고, 잔량이 남을 경우 자신의 호가창에 적재합니다.

```java
// MatchingEngine.java 핵심 루프
private void matchBuy(Order buy) {
    while (buy.qty > 0 && !book.asks.isEmpty()) {
        var best = book.asks.firstEntry(); // 최우선 매도 호가
        if (best.getKey() > buy.price) break; // 매수 단가가 낮으면 매칭 불가

        var resting = best.getValue().peekFirst(); // 가장 먼저 들어온 매도 주문
        long traded = Math.min(buy.qty, resting.qty);

        buy.qty -= traded;
        resting.qty -= traded;

        // 1. 체결 이벤트 발생 (Trade)
        outbox.trade(symbol, ++seq, buy, resting, traded);

        // 2. 호가창 변동 이벤트 발생 (Delta)
        outbox.delta(symbol, seq, Side.SELL, resting.price, -traded);
        outbox.delta(symbol, seq, Side.BUY,  buy.price,  traded);

        if (resting.qty == 0) {
            best.getValue().pollFirst();
            book.orderIndex.remove(resting.orderId);
            book.orderPriceIndex.remove(resting.orderId);
        }
        if (best.getValue().isEmpty()) book.asks.remove(best.getKey());
    }
    // 매칭 후 남은 수량이 있으면 호가창에 적재
    if (buy.qty > 0) book.add(buy);
}
```

## 4. 도메인 모델 및 커맨드
```java
public final class Order {
    public final long orderId;
    public final Side side;
    public final long price; // 정수형 가격 (예: 65000.00 -> 6500000)
    public long qty;
    public final long ts;

    public Order(long orderId, Side side, long price, long qty, long ts) {
        this.orderId = orderId;
        this.side = side;
        this.price = price;
        this.qty = qty;
        this.ts = ts;
    }
}

// Sealed Interface를 활용한 커맨드 패턴
public sealed interface Command permits NewOrderCmd, CancelOrderCmd {}
public record NewOrderCmd(Order order) implements Command {}
public record CancelOrderCmd(long orderId) implements Command {}
```

## 5. 정합성 및 복구 전략
*   **Sequence Number:** 모든 이벤트(Trade, Delta, Cancel)에 일련번호(`seq`)를 부여하여 UI 및 다운스트림 서비스에서 중복 처리 방지 및 순서 보장을 수행합니다.
*   **Idempotent Cancel:** 이미 체결되었거나 존재하지 않는 주문에 대한 취소 요청은 무시함으로써 정합성을 유지합니다.
*   **Snapshot & Replay:** 주기적인 인메모리 스냅샷과 Kafka 이벤트 리플레이를 통해 장애 발생 시 엔진 상태를 100% 복구합니다.
