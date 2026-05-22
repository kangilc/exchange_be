package exchange.kafka;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.Socket;
import java.util.Properties;

public final class AdapterKafkaRunner {
    public static void main(String[] args) {
        String broker = System.getenv("KAFKA_BROKER");
        if (broker == null || broker.isEmpty()) {
            broker = "localhost:9092";
        }

        String engineHost = System.getenv("ENGINE_HOST");
        if (engineHost == null || engineHost.isEmpty()) {
            engineHost = "localhost";
        }

        int enginePort = 9998;
        String enginePortStr = System.getenv("ENGINE_PORT");
        if (enginePortStr != null && !enginePortStr.isEmpty()) {
            enginePort = Integer.parseInt(enginePortStr);
        }

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
