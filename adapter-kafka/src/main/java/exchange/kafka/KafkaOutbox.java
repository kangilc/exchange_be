package exchange.kafka;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;

import java.util.Properties;

/**
 * 매칭 엔진으로부터 온 원시(raw) CSV 포맷 텍스트를 구조화된 JSON 문자열로 변환하고,
 * 각 메시지 유형별로 상응하는 Kafka 토픽으로 비동기 전송하는 클래스입니다.
 */
public final class KafkaOutbox {
    // 내부 실제 Kafka 메시지 전송을 처리할 프로듀서 객체
    private final KafkaProducer<String, String> producer;
    
    // Kafka 토픽 이름 정의
    private final String acceptTopic = "accept-events";     // 주문 접수 이벤트
    private final String deltaTopic = "orderbook-delta";     // 호가창(오더북) 변경 이벤트
    private final String tradeTopic = "trade-events";         // 주문 체결 이벤트
    private final String cancelTopic = "cancel-events";       // 주문 취소 이벤트

    /**
     * 지정된 속성값을 바탕으로 KafkaOutbox를 구성합니다.
     * 
     * @param props Kafka 프로듀서 생성 설정 속성
     */
    public KafkaOutbox(Properties props) {
        this.producer = new KafkaProducer<>(props);
    }

    /**
     * 매칭 엔진으로부터 받은 원시 CSV 라인을 파싱하고, 각 타입에 해당하는 Kafka 토픽에 JSON 포맷으로 메시지를 발행합니다.
     *
     * @param line 매칭 엔진이 송신한 문자열 라인 (예: "ACCEPT,BTC-USD,1,1001,50001,BUY,12300,5")
     */
    public void processEngineEvent(String line) {
        // 쉼표(,) 구분자로 이벤트를 분할합니다.
        String[] parts = line.split(",");
        String type = parts[0];     // 이벤트 타입 (ACCEPT, DELTA, TRADE, CANCEL)
        String symbol = parts[1];   // 마켓 심볼 (예: BTC-USD)

        if (type.equals("ACCEPT")) {
            // [주문 접수 이벤트] 포맷: ACCEPT,symbol,seq,orderId,userId,side,price,qty
            long seq = Long.parseLong(parts[2]);
            long orderId = Long.parseLong(parts[3]);
            long userId = Long.parseLong(parts[4]);
            String side = parts[5];
            long price = Long.parseLong(parts[6]);
            long qty = Long.parseLong(parts[7]);

            // 이벤트를 JSON 포맷으로 생성합니다.
            String jsonPayload = String.format(
                    "{\"type\":\"ACCEPT\",\"symbol\":\"%s\",\"seq\":%d,\"orderId\":%d,\"userId\":%d,\"side\":\"%s\",\"price\":%d,\"qty\":%d,\"ts\":%d}",
                    symbol, seq, orderId, userId, side, price, qty, System.currentTimeMillis()
            );
            // Kafka의 acceptTopic으로 발행합니다. 심볼을 파티션 키로 사용하여 순서를 보장합니다.
            producer.send(new ProducerRecord<>(acceptTopic, symbol, jsonPayload));

        } else if (type.equals("DELTA")) {
            // [호가창 변동 이벤트] 포맷: DELTA,symbol,seq,side,price,deltaQty
            long seq = Long.parseLong(parts[2]);
            String side = parts[3];
            long price = Long.parseLong(parts[4]);
            long deltaQty = Long.parseLong(parts[5]);

            String jsonPayload = String.format(
                    "{\"type\":\"DELTA\",\"symbol\":\"%s\",\"seq\":%d,\"side\":\"%s\",\"price\":%d,\"deltaQty\":%d,\"ts\":%d}",
                    symbol, seq, side, price, deltaQty, System.currentTimeMillis()
            );
            // Kafka의 deltaTopic으로 발행합니다.
            producer.send(new ProducerRecord<>(deltaTopic, symbol, jsonPayload));

        } else if (type.equals("TRADE")) {
            // [주문 체결 이벤트] 포맷: TRADE,symbol,seq,takerOrderId,takerUserId,makerOrderId,makerUserId,price,qty
            long seq = Long.parseLong(parts[2]);
            long takerOrderId = Long.parseLong(parts[3]);
            long takerUserId = Long.parseLong(parts[4]);
            long makerOrderId = Long.parseLong(parts[5]);
            long makerUserId = Long.parseLong(parts[6]);
            long price = Long.parseLong(parts[7]);
            long qty = Long.parseLong(parts[8]);

            String jsonPayload = String.format(
                    "{\"type\":\"TRADE\",\"symbol\":\"%s\",\"seq\":%d,\"takerOrderId\":%d,\"takerUserId\":%d,\"makerOrderId\":%d,\"makerUserId\":%d,\"price\":%d,\"qty\":%d,\"ts\":%d}",
                    symbol, seq, takerOrderId, takerUserId, makerOrderId, makerUserId, price, qty, System.currentTimeMillis()
            );
            // Kafka의 tradeTopic으로 발행합니다.
            producer.send(new ProducerRecord<>(tradeTopic, symbol, jsonPayload));

        } else if (type.equals("CANCEL")) {
            // [주문 취소 이벤트] 포맷: CANCEL,symbol,seq,orderId,userId
            long seq = Long.parseLong(parts[2]);
            long orderId = Long.parseLong(parts[3]);
            long userId = Long.parseLong(parts[4]);

            String jsonPayload = String.format(
                    "{\"type\":\"CANCEL\",\"symbol\":\"%s\",\"seq\":%d,\"orderId\":%d,\"userId\":%d,\"ts\":%d}",
                    symbol, seq, orderId, userId, System.currentTimeMillis()
            );
            // Kafka의 cancelTopic으로 발행합니다.
            producer.send(new ProducerRecord<>(cancelTopic, symbol, jsonPayload));
        }
    }

    /**
     * Kafka 프로듀서 리소스를 해제 및 정중히 종료합니다.
     */
    public void close() {
        producer.close();
    }
}

