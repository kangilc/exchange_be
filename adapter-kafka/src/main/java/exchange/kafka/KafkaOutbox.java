package exchange.kafka;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.clients.producer.Callback;
import org.apache.kafka.common.KafkaException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Properties;

/**
 * 매칭 엔진으로부터 온 원시(raw) CSV 포맷 텍스트를 구조화된 JSON 문자열로 변환하고,
 * 각 메시지 유형별로 상응하는 Kafka 토픽으로 비동기 전송
 */
public final class KafkaOutbox {
    private static final Logger log = LoggerFactory.getLogger(KafkaOutbox.class);

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

        String[] parts;
        String type;
        String symbol;

        // 1. 데이터 파싱 단계 (포맷 불일치나 파싱 오류는 로그만 출력 후 스킵)
        try {
            parts = line.split(",");
            if (parts.length < 2) {
                log.error("잘못된 이벤트 포맷 (필드 부족): {}", line);
                return;
            }
            type = parts[0];
            symbol = parts[1];
        } catch (Exception e) {
            log.error("이벤트 스플릿 오류 (무시): {} | 라인: {}", e.getMessage(), line);
            return;
        }

        // 각 타입별 파싱 및 전송
        try {
            if (type.equals("ACCEPT")) {
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
                sendToKafka(KafkaConfig.TOPIC_ACCEPT, symbol, jsonPayload, "ACCEPT");

            } else if (type.equals("DELTA")) {
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
                sendToKafka(KafkaConfig.TOPIC_DELTA, symbol, jsonPayload, "DELTA");

            } else if (type.equals("TRADE")) {
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
                sendToKafka(KafkaConfig.TOPIC_TRADE, symbol, jsonPayload, "TRADE");

            } else if (type.equals("CANCEL")) {
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
                sendToKafka(KafkaConfig.TOPIC_CANCEL, symbol, jsonPayload, "CANCEL");
            }
        } catch (NumberFormatException | ArrayIndexOutOfBoundsException e) {
            // 데이터 포맷 변환 오류는 로그 출력 후 스킵
            log.error("데이터 필드 값 변환 실패 (무시): {} | 라인: {}", e.getMessage(), line);
        }
    }

    /**
     * Kafka 전송을 수행하고 치명적인 예외는 상위로 전파
     */
    private void sendToKafka(String topic, String key, String value, String eventType) {
        try {
            producer.send(new ProducerRecord<>(topic, key, value), new TrackingCallback(eventType, key));
        } catch (KafkaException | IllegalStateException e) {
            // Kafka 클라이언트 치명적인 오류나 프로듀서 비정상 상태는 상위 호출자로 전파하여 재연결 유도
            log.error("치명적인 Kafka 예외 발생 (토픽: {}) -> 재전파", topic);
            throw e;
        } catch (Exception e) {
            log.error("기타 전송 실패 (토픽: {}) -> {}", topic, e.getMessage());
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
                log.error("{} 이벤트 전송 실패 (심볼: {}) -> {}", eventType, symbol, exception.getMessage());
            }
        }
    }
}
