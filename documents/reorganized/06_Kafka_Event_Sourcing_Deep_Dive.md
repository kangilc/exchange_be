# 06. Kafka 이벤트 소싱 및 메시지 처리 (Kafka Event Sourcing)

본 문서는 매칭 엔진의 출력을 외부로 전송하고 전체 시스템의 상태 일관성을 유지하기 위한 Kafka 기반 이벤트 소싱 설계를 상세히 설명합니다.

## 1. 이벤트 소싱 설계 원칙
*   **Deterministic Output:** 매칭 엔진은 동일한 입력(주문)에 대해 반드시 동일한 출력(체결/델타)을 생성하며, 이 순서는 Kafka 파티션을 통해 보존됩니다.
*   **Symbol-based Partitioning:** `symbol`을 파티션 키로 사용하여 동일 종목의 모든 이벤트가 동일한 파티션에 순차적으로 적재되도록 보장합니다.
*   **Delta over Snapshot:** 전체 호가창을 매번 전송하는 대신, 변동분(Delta)만 전송하여 네트워크 대역폭을 최적화합니다.

## 2. Kafka 이벤트 스키마 (Avro)
정형화된 데이터 전송과 스키마 진화를 위해 Avro를 사용하며, Confluent Schema Registry를 통해 관리합니다.

```json
// OrderBookDelta.avsc
{
  "namespace": "exchange.orderbook",
  "type": "record",
  "name": "OrderBookDelta",
  "fields": [
    { "name": "symbol", "type": "string" },
    { "name": "seq", "type": "long" },
    { "name": "side", "type": { "type": "enum", "name": "Side", "symbols": ["BUY","SELL"] }},
    { "name": "price", "type": "long" },
    { "name": "deltaQty", "type": "long" },
    { "name": "ts", "type": "long" }
  ]
}
```

## 3. 이벤트 타입 및 JSON 예시
운영 환경에서는 바이너리(Avro/SBE)를 사용하지만, 디버깅 및 분석을 위해 아래와 같은 논리적 구조를 가집니다.

*   **DELTA:** 호가창의 특정 가격대 수량 변동
*   **TRADE:** 실제 체결 발생 정보
*   **CANCEL:** 주문 취소 확정

```json
// TRADE 이벤트 예시
{
  "type": "TRADE",
  "symbol": "BTC-USD",
  "seq": 102346,
  "price": 6500000,
  "qty": 50,
  "ts": 1713160000124
}
```

## 4. Producer 전략 및 구현
매칭 엔진 내부 또는 전용 어댑터에서 Kafka Producer를 실행하며, 성능과 안정성을 위해 아래 설정을 적용합니다.

*   **acks=all:** 데이터 유실 절대 방지.
*   **enable.idempotence=true:** 중복 메시지 전송 방지.
*   **linger.ms=0~5:** 지연 시간과 처리량(Throughput) 사이의 균형 조절.

```java
// EventOutbox 인터페이스 구현 예시
public interface EventOutbox {
    void delta(String symbol, long seq, Side side, long price, long deltaQty);
    void trade(String symbol, long seq, Order taker, Order maker, long qty);
    void cancel(String symbol, long seq, Order order);
}

// Kafka 어댑터에서의 구현
public class KafkaOutbox implements EventOutbox {
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Override
    public void trade(String symbol, long seq, Order taker, Order maker, long qty) {
        TradeEvent event = new TradeEvent(symbol, seq, taker, maker, qty);
        kafkaTemplate.send("trade-events", symbol, event);
    }
}
```

## 5. Consumer 및 상태 동기화 (UI/API)
*   **Sequence Gap Detection:** UI 클라이언트는 수신한 이벤트의 `seq`가 연속되지 않을 경우(Gap 발생), 즉시 최신 스냅샷(Full Snapshot)을 요청하여 상태를 재동기화합니다.
*   **Idempotent Processing:** 소비자 측에서는 `seq`를 기준으로 이미 처리한 메시지를 무시함으로써 'At-least-once' 전달 환경에서도 'Exactly-once' 효과를 냅니다.
