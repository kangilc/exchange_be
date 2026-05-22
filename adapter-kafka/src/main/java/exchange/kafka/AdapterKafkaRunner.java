package exchange.kafka;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;
import java.util.Properties;

public final class AdapterKafkaRunner {
    public static void main(String[] args) {
        String broker = ConfigLoader.get("KAFKA_BROKER", "localhost:9092");
        String engineHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        int enginePort = ConfigLoader.getInt("ENGINE_PORT", 9998);


        System.out.println("Starting Kafka Adapter...");
        System.out.println("Kafka Broker: " + broker);
        System.out.println("Connecting to Engine at " + engineHost + ":" + enginePort);

        Properties props = KafkaConfig.getProducerProperties(broker);
        KafkaOutbox outbox = new KafkaOutbox(props);

        long retryDelay = 1000;
        while (true) {
            try (Socket socket = new Socket(engineHost, enginePort);
                 BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()))) {
                
                System.out.println("Successfully connected to Matching Engine!");
                retryDelay = 1000; // reset retry delay on success
                
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.isEmpty()) continue;
                    outbox.processEngineEvent(line);
                }
            } catch (Exception e) {
                System.err.println("Lost connection to Matching Engine: " + e.getMessage());
                System.err.println("Reconnecting in " + retryDelay + "ms...");
                try {
                    Thread.sleep(retryDelay);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
                // Exponential backoff up to 30s
                retryDelay = Math.min(retryDelay * 2, 30000);
            }
        }
        
        outbox.close();
    }
}
