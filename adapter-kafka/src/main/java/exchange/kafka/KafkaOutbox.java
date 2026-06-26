package exchange.kafka;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.clients.producer.Callback;

import java.util.Properties;

/**
 * 매칭 엔진으로부터 온 원시(raw) CSV 포맷 텍스트를 구조화된 JSON 문자열로 변환하고,
 * 각 메시지 유형별로 상응하는 Kafka 토픽으로 비동기 전송
 */
public final class KafkaOutbox {
    // 내부 실제 Kafka 메시지 전송을 처리할 프로듀서 객체
    private final KafkaProducer<String, String> producer;

    /**
     * 지정된 속성값을 바탕으로 KafkaOutbox를 구성
     * 
     * @param props Kafka 프로듀서 생성 설정 속성
     */
    public KafkaOutbox(Properties props) {
        this.producer = new KafkaProducer<>(props);
    }

    /**
     * 매칭 엔진으로부터 받은 원시 CSV 라인을 파싱하고, 각 타입에 해당하는 Kafka 토픽에 JSON 포맷으로 메시지를 발행
     *
     * @param line 매칭 엔진이 송신한 문자열 라인 (예: "ACCEPT,BTC-USD,1,1001,50001,BUY,12300,5")
     */
    public void processEngineEvent(String line) {
        if (line == null || line.trim().isEmpty()) {
            return;
        }

        try {
            // 쉼표(,) 구분자로 이벤트를 분할
            String[] parts = line.split(",");
            if (parts.length < 2) {
                System.err.println("[KafkaOutbox] 잘못된 이벤트 포맷 (필드 부족): " + line);
                return;
            }

            String type = parts[0]; // 이벤트 타입 (ACCEPT, DELTA, TRADE, CANCEL)
            String symbol = parts[1]; // 마켓 심볼 (예: BTC-USD)

            if (type.equals("ACCEPT")) {
                // [주문 접수 이벤트] 포맷: ACCEPT,symbol,seq,orderId,userId,side,price,qty
                long seq = Long.parseLong(parts[2]);
                long orderId = Long.parseLong(parts[3]);
                long userId = Long.parseLong(parts[4]);
                String side = parts[5];
                long price = Long.parseLong(parts[6]);
                long qty = Long.parseLong(parts[7]);

                // 성능 및 GC 최적화를 위한 StringBuilder 기반 JSON 직렬화
                StringBuilder sb = new StringBuilder(180);
                sb.append("{\"type\":\"ACCEPT\",\"symbol\":\"").append(symbol)
                  .append("\",\"seq\":").append(seq)
                  .append(",\"orderId\":").append(orderId)
                  .append(",\"userId\":").append(userId)
                  .append(",\"side\":\"").append(side)
                  .append("\",\"price\":").append(price)
                  .append(",\"qty\":").append(qty)
                  .append(",\"ts\":").append(System.currentTimeMillis())
                  .append("}");
                
                String jsonPayload = sb.toString();
                // Kafka 공용 토픽 상수를 이용해 발행 및 에러 감지
                producer.send(new ProducerRecord<>(KafkaConfig.TOPIC_ACCEPT, symbol, jsonPayload), new TrackingCallback("ACCEPT", symbol));

            } else if (type.equals("DELTA")) {
                // [호가창 변동 이벤트] 포맷: DELTA,symbol,seq,side,price,deltaQty
                long seq = Long.parseLong(parts[2]);
                String side = parts[3];
                long price = Long.parseLong(parts[4]);
                long deltaQty = Long.parseLong(parts[5]);

                StringBuilder sb = new StringBuilder(150);
                sb.append("{\"type\":\"DELTA\",\"symbol\":\"").append(symbol)
                  .append("\",\"seq\":").append(seq)
                  .append(",\"side\":\"").append(side)
                  .append("\",\"price\":").append(price)
                  .append(",\"deltaQty\":").append(deltaQty)
                  .append(",\"ts\":").append(System.currentTimeMillis())
                  .append("}");

                String jsonPayload = sb.toString();
                producer.send(new ProducerRecord<>(KafkaConfig.TOPIC_DELTA, symbol, jsonPayload), new TrackingCallback("DELTA", symbol));

            } else if (type.equals("TRADE")) {
                // [주문 체결 이벤트] 포맷: TRADE,symbol,seq,takerOrderId,takerUserId,makerOrderId,makerUserId,price,qty
                long seq = Long.parseLong(parts[2]);
                long takerOrderId = Long.parseLong(parts[3]);
                long takerUserId = Long.parseLong(parts[4]);
                long makerOrderId = Long.parseLong(parts[5]);
                long makerUserId = Long.parseLong(parts[6]);
                long price = Long.parseLong(parts[7]);
                long qty = Long.parseLong(parts[8]);

                StringBuilder sb = new StringBuilder(220);
                sb.append("{\"type\":\"TRADE\",\"symbol\":\"").append(symbol)
                  .append("\",\"seq\":").append(seq)
                  .append(",\"takerOrderId\":").append(takerOrderId)
                  .append(",\"takerUserId\":").append(takerUserId)
                  .append(",\"makerOrderId\":").append(makerOrderId)
                  .append(",\"makerUserId\":").append(makerUserId)
                  .append(",\"price\":").append(price)
                  .append(",\"qty\":").append(qty)
                  .append(",\"ts\":").append(System.currentTimeMillis())
                  .append("}");

                String jsonPayload = sb.toString();
                producer.send(new ProducerRecord<>(KafkaConfig.TOPIC_TRADE, symbol, jsonPayload), new TrackingCallback("TRADE", symbol));

            } else if (type.equals("CANCEL")) {
                // [주문 취소 이벤트] 포맷: CANCEL,symbol,seq,orderId,userId
                long seq = Long.parseLong(parts[2]);
                long orderId = Long.parseLong(parts[3]);
                long userId = Long.parseLong(parts[4]);

                StringBuilder sb = new StringBuilder(140);
                sb.append("{\"type\":\"CANCEL\",\"symbol\":\"").append(symbol)
                  .append("\",\"seq\":").append(seq)
                  .append(",\"orderId\":").append(orderId)
                  .append(",\"userId\":").append(userId)
                  .append(",\"ts\":").append(System.currentTimeMillis())
                  .append("}");

                String jsonPayload = sb.toString();
                producer.send(new ProducerRecord<>(KafkaConfig.TOPIC_CANCEL, symbol, jsonPayload), new TrackingCallback("CANCEL", symbol));
            }
        } catch (Exception e) {
            // 패킷 결함 발생 시 어댑터가 기동 중단되지 않도록 안전 가드
            System.err.println("[KafkaOutbox] 이벤트 파싱/전송 중 예외 발생 (데이터 무시): " + e.getMessage() + " | 원시 데이터: " + line);
        }
    }

    /**
     * Kafka 프로듀서 리소스를 해제 및 종료
     */
    public void close() {
        producer.close();
    }

    /**
     * Kafka 비동기 전송 시 결과 및 에러 감지를 위한 콜백 클래스
     */
    private static class TrackingCallback implements Callback {
        private final String eventType;
        private final String symbol;

        public TrackingCallback(String eventType, String symbol) {
            this.eventType = eventType;
            this.symbol = symbol;
        }

        @Override
        public void onCompletion(RecordMetadata metadata, Exception exception) {
            if (exception != null) {
                System.err.printf("[KafkaOutbox] %s 이벤트 전송 실패 (심볼: %s) -> %s\n", 
                        eventType, symbol, exception.getMessage());
            }
        }
    }
}
