package exchange.kafka;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;

/**
 * Kafka 프로듀서 실행에 필요한 Properties 설정을 제공하는 설정 클래스
 */
public final class KafkaConfig {
    // 공용 Kafka 토픽 이름 정의
    public static final String TOPIC_ACCEPT = "accept-events";   // 주문 접수 이벤트
    public static final String TOPIC_DELTA = "orderbook-delta"; // 호가창(오더북) 변경 이벤트
    public static final String TOPIC_TRADE = "trade-events";    // 주문 체결 이벤트
    public static final String TOPIC_CANCEL = "cancel-events";  // 주문 취소 이벤트
    /**
     * 지정된 bootstrapServers를 기반으로 Kafka Producer 설정 속성들을 생성
     * 
     * @param bootstrapServers Kafka 브로커 주소 (예: "localhost:9092")
     * @return 설정된 Properties 객체
     */
    public static Properties getProducerProperties(String bootstrapServers) {
        Properties props = new Properties();

        // 1. Kafka 클러스터 내 브로커 주소를 설정
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);

        // 2. 메시지의 Key와 Value 직렬화 클래스를 StringSerializer로 지정
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());

        // 3. 메시지 발행 신뢰성 강화를 위해 ACKS 설정을 'all'로 지정 (모든 복제본에 기록 확인)
        props.put(ProducerConfig.ACKS_CONFIG, "all");

        // 4. 멱등성 프로듀서(Idempotent Producer) 활성화를 통해 중복 메시지 전송 및 순서 뒤바뀜 방지
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, "true");

        return props;
    }
}
