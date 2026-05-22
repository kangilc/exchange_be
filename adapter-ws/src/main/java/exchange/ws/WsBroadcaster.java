package exchange.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.buffer.Unpooled;
import io.netty.channel.group.ChannelGroup;
import io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.Collections;
import java.util.Properties;

public final class WsBroadcaster implements Runnable {
    private final ChannelGroup clients;
    private final KafkaConsumer<String, String> consumer;
    private final ObjectMapper mapper = new ObjectMapper();
    private boolean running = true;

    public WsBroadcaster(ChannelGroup clients, String broker) {
        this.clients = clients;
        
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, broker);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "ws-broadcaster-group-" + System.currentTimeMillis());
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest");
        
        this.consumer = new KafkaConsumer<>(props);
    }

    @Override
    public void run() {
        System.out.println("Subscribing to orderbook-delta Kafka topic...");
        consumer.subscribe(Collections.singletonList("orderbook-delta"));
        
        while (running) {
            try {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
                for (ConsumerRecord<String, String> record : records) {
                    if (clients.isEmpty()) continue; // Skip CPU serialization cycles if no active WS clients
                    
                    try {
                        JsonNode json = mapper.readTree(record.value());
                        String symbol = json.get("symbol").asText();
                        int symbolId = Math.abs(symbol.hashCode());
                        long seq = json.get("seq").asLong();
                        String sideStr = json.get("side").asText();
                        int side = sideStr.equalsIgnoreCase("BUY") ? 0 : 1;
                        long price = json.get("price").asLong();
                        long deltaQty = json.get("deltaQty").asLong();
                        
                        ByteBuffer buffer = BinaryCodec.encodeDelta(symbolId, seq, price, deltaQty, side);
                        clients.writeAndFlush(new BinaryWebSocketFrame(Unpooled.wrappedBuffer(buffer)));
                    } catch (Exception e) {
                        System.err.println("Failed to parse or broadcast event: " + e.getMessage());
                    }
                }
            } catch (Exception e) {
                System.err.println("Kafka consumer loop error: " + e.getMessage());
            }
        }
        consumer.close();
    }

    public void stop() {
        this.running = false;
    }
}
