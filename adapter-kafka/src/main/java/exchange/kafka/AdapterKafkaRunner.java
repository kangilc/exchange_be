package exchange.kafka;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import org.apache.kafka.common.KafkaException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 매칭 엔진의 이벤트를 실시간으로 수신하여 Kafka로 중계하는 실행기 클래스
 * 
 * 매칭 엔진이 소켓을 통해 발행하는 CSV 형태의 로우(raw) 이벤트를 한 줄씩 읽어서
 * KafkaOutbox를 통해 구조화된 JSON 메시지로 Kafka 토픽에 발행
 * 엔진과의 연결이 끊어질 경우 지수 백오프(Exponential Backoff)를 적용하여 재연결을 시도
 */
public final class AdapterKafkaRunner {
    private static final Logger log = LoggerFactory.getLogger(AdapterKafkaRunner.class);

    public static void main(String[] args) {
        // 환경 변수 또는 설정 파일에서 설정 조회 (하드코딩 제거)
        String broker = ConfigLoader.get("KAFKA_BROKER", "localhost:9092");
        String engineHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        int enginePort = ConfigLoader.getInt("ENGINE_PORT", 9998);

        // 연결 및 대기 관련 설정 로드
        int connectTimeout = ConfigLoader.getInt("ENGINE_CONNECT_TIMEOUT_MS", 5000);
        int readTimeout = ConfigLoader.getInt("ENGINE_READ_TIMEOUT_MS", 60000); // 60초간 응답 없으면 타임아웃
        int maxBackoff = ConfigLoader.getInt("MAX_BACKOFF_MS", 30000);

        log.info("Starting Kafka Adapter...");
        log.info("Kafka Broker: {}", broker);
        log.info("Connecting to Engine at {}:{}", engineHost, enginePort);

        // Kafka 프로듀서 설정을 생성하고 아웃박스 객체를 초기화
        Properties props = KafkaConfig.getProducerProperties(broker);
        KafkaOutbox outbox = new KafkaOutbox(props);

        // JVM 종료 시 Kafka 프로듀서 리소스를 안전하게 닫도록 셧다운 훅 등록
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            log.info("Shutting down Kafka Adapter, closing outbox...");
            outbox.close();
        }));

        // 매칭 엔진 재연결 대기 시간 설정 (초기값 1초)
        long retryDelay = 1000;

        // 매칭 엔진 이벤트를 실시간 수신하기 위한 무한 루프
        while (true) {
            // 소켓 타임아웃 및 KeepAlive 설정을 위해 Socket 객체를 직접 생성 및 연결 설정
            try (Socket socket = new Socket()) {
                socket.setKeepAlive(true);
                // 연결 타임아웃 적용하여 연결 시도
                socket.connect(new InetSocketAddress(engineHost, enginePort), connectTimeout);
                // 읽기 타임아웃(SoTimeout) 설정
                socket.setSoTimeout(readTimeout);

                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {

                    log.info("Successfully connected to Matching Engine!");
                    retryDelay = 1000; // 연결 성공 시 재연결 대기 시간을 초기값(1초)으로 재설정

                    String line;
                    // 소켓 스트림으로부터 매칭 엔진이 보낸 이벤트를 한 줄씩 수신
                    while ((line = reader.readLine()) != null) {
                        if (line.isEmpty()) {
                            continue; // 빈 줄은 무시
                        }
                        // 수신한 로우 이벤트를 Kafka 토픽으로 발행
                        // 치명적인 Kafka 전송 오류가 발생하면 KafkaException이 던져짐
                        outbox.processEngineEvent(line);
                    }
                }
            } catch (KafkaException | IllegalStateException ke) {
                // Kafka 전송과 관련된 치명적인 내부 클라이언트 오류 발생 시 로그 기록 후 소켓 재연결 시도
                log.error("Fatal Kafka Producer Exception encountered: ", ke);
                handleBackoff(retryDelay, maxBackoff);
                retryDelay = Math.min(retryDelay * 2, maxBackoff);
            } catch (Exception e) {
                // 매칭 엔진과의 연결 실패, 읽기 타임아웃 또는 연결 끊김 예외 처리
                log.error("Connection issue with Matching Engine: {}", e.getMessage());
                handleBackoff(retryDelay, maxBackoff);
                retryDelay = Math.min(retryDelay * 2, maxBackoff);
            }
        }
    }

    /**
     * 연결 복구를 위한 지수 백오프 대기 처리
     */
    private static void handleBackoff(long delay, int maxBackoff) {
        log.warn("Reconnecting in {}ms (Max backoff: {}ms)...", delay, maxBackoff);
        try {
            Thread.sleep(delay);
        } catch (InterruptedException ie) {
            // 스레드 인터럽트 발생 시 인터럽트 상태를 유지
            Thread.currentThread().interrupt();
        }
    }
}
