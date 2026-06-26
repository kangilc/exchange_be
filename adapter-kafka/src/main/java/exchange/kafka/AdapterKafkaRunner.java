package exchange.kafka;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

/**
 * 매칭 엔진의 이벤트를 실시간으로 수신하여 Kafka로 중계하는 실행기 클래스
 * 
 * 매칭 엔진이 소켓을 통해 발행하는 CSV 형태의 로우(raw) 이벤트를 한 줄씩 읽어서
 * KafkaOutbox를 통해 구조화된 JSON 메시지로 Kafka 토픽에 발행
 * 엔진과의 연결이 끊어질 경우 지수 백오프(Exponential Backoff)를 적용하여 재연결을 시도
 */
public final class AdapterKafkaRunner {
    public static void main(String[] args) {
        // 환경 변수 또는 설정 파일에서 Kafka 브로커 정보 및 매칭 엔진 호스트/포트 정보를 조회
        String broker = ConfigLoader.get("KAFKA_BROKER", "localhost:9092");
        String engineHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        int enginePort = ConfigLoader.getInt("ENGINE_PORT", 9998);

        System.out.println("Starting Kafka Adapter...");
        System.out.println("Kafka Broker: " + broker);
        System.out.println("Connecting to Engine at " + engineHost + ":" + enginePort);

        // Kafka 프로듀서 설정을 생성하고 아웃박스 객체를 초기화
        Properties props = KafkaConfig.getProducerProperties(broker);
        KafkaOutbox outbox = new KafkaOutbox(props);

        // JVM 종료 시 Kafka 프로듀서 리소스를 안전하게 닫도록 셧다운 훅 등록
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Shutting down Kafka Adapter, closing outbox...");
            outbox.close();
        }));

        // 매칭 엔진 재연결 대기 시간 설정 (초기값 1초)
        long retryDelay = 1000;

        // 매칭 엔진 이벤트를 실시간 수신하기 위한 무한 루프
        while (true) {
            try (Socket socket = new Socket(engineHost, enginePort);
                 BufferedReader reader = new BufferedReader(
                         new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {

                System.out.println("Successfully connected to Matching Engine!");
                retryDelay = 1000; // 연결 성공 시 재연결 대기 시간을 초기값(1초)으로 재설정

                String line;
                // 소켓 스트림으로부터 매칭 엔진이 보낸 이벤트를 한 줄씩 수신
                while ((line = reader.readLine()) != null) {
                    if (line.isEmpty()) {
                        continue; // 빈 줄은 무시
                    }
                    // 수신한 로우 이벤트를 Kafka 토픽으로 발행
                    outbox.processEngineEvent(line);
                }
            } catch (Exception e) {
                // 매칭 엔진과의 연결 실패 또는 연결 끊김 예외 처리
                System.err.println("Lost connection to Matching Engine: " + e.getMessage());
                System.err.println("Reconnecting in " + retryDelay + "ms...");
                try {
                    Thread.sleep(retryDelay);
                } catch (InterruptedException ie) {
                    // 스레드 인터럽트 발생 시 루프를 종료하고 스레드를 종료
                    Thread.currentThread().interrupt();
                    break;
                }
                // 연결 실패 시 대기 시간을 2배씩 늘리며 재시도하며, 최대 30초까지 지수 백오프 적용
                retryDelay = Math.min(retryDelay * 2, 30000);
            }
        }
    }
}
