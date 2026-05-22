package exchange.kafka;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;

import java.util.Properties;

public final class KafkaOutbox {
    private final KafkaProducer<String, String> producer;
    private final String acceptTopic = "accept-events";
    private final String deltaTopic = "orderbook-delta";
    private final String tradeTopic = "trade-events";
    private final String cancelTopic = "cancel-events";

    public KafkaOutbox(Properties props) {
        this.producer = new KafkaProducer<>(props);
    }

    public void processEngineEvent(String line) {
        String[] parts = line.split(",");
        String type = parts[0];
        String symbol = parts[1];

        if (type.equals("ACCEPT")) {
            long seq = Long.parseLong(parts[2]);
            long orderId = Long.parseLong(parts[3]);
            long userId = Long.parseLong(parts[4]);
            String side = parts[5];
            long price = Long.parseLong(parts[6]);
            long qty = Long.parseLong(parts[7]);

            String jsonPayload = String.format(
                    "{\"type\":\"ACCEPT\",\"symbol\":\"%s\",\"seq\":%d,\"orderId\":%d,\"userId\":%d,\"side\":\"%s\",\"price\":%d,\"qty\":%d,\"ts\":%d}",
                    symbol, seq, orderId, userId, side, price, qty, System.currentTimeMillis()
            );
            producer.send(new ProducerRecord<>(acceptTopic, symbol, jsonPayload));

        } else if (type.equals("DELTA")) {
            long seq = Long.parseLong(parts[2]);
            String side = parts[3];
            long price = Long.parseLong(parts[4]);
            long deltaQty = Long.parseLong(parts[5]);

            String jsonPayload = String.format(
                    "{\"type\":\"DELTA\",\"symbol\":\"%s\",\"seq\":%d,\"side\":\"%s\",\"price\":%d,\"deltaQty\":%d,\"ts\":%d}",
                    symbol, seq, side, price, deltaQty, System.currentTimeMillis()
            );
            producer.send(new ProducerRecord<>(deltaTopic, symbol, jsonPayload));

        } else if (type.equals("TRADE")) {
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
            producer.send(new ProducerRecord<>(tradeTopic, symbol, jsonPayload));

        } else if (type.equals("CANCEL")) {
            long seq = Long.parseLong(parts[2]);
            long orderId = Long.parseLong(parts[3]);
            long userId = Long.parseLong(parts[4]);

            String jsonPayload = String.format(
                    "{\"type\":\"CANCEL\",\"symbol\":\"%s\",\"seq\":%d,\"orderId\":%d,\"userId\":%d,\"ts\":%d}",
                    symbol, seq, orderId, userId, System.currentTimeMillis()
            );
            producer.send(new ProducerRecord<>(cancelTopic, symbol, jsonPayload));
        }
    }

    public void close() {
        producer.close();
    }
}
