package exchange.kafka.db;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import exchange.kafka.ConfigLoader;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Properties;

public final class DbPersisterRunner {
    private static final String KAFKA_BROKER = ConfigLoader.get("KAFKA_BROKER", "localhost:9092");
    private static final String DB_URL = ConfigLoader.get("DB_URL", "jdbc:postgresql://localhost:5432/exchange");
    private static final String DB_USER = ConfigLoader.get("DB_USER", "postgres");
    private static final String DB_PASSWORD = ConfigLoader.get("DB_PASSWORD", "postgres");

    private static final ObjectMapper mapper = new ObjectMapper();

    private static final java.util.concurrent.ConcurrentHashMap<String, Double> feeRatesCache = new java.util.concurrent.ConcurrentHashMap<>();
    private static volatile long lastFeeRatesLoadTs = 0;

    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("  🌌 HIGH-PERFORMANCE DB SETTLEMENT PERSISTER  ");
        System.out.println("==================================================");
        System.out.println("Connecting to database: " + DB_URL);
        System.out.println("Kafka Broker          : " + KAFKA_BROKER);

        // Try to warm up database connection
        try (Connection conn = getConnection()) {
            System.out.println("Successfully connected to PostgreSQL database!");
        } catch (Exception e) {
            System.err.println("Database connection failed. Persister will retry continuously: " + e.getMessage());
        }

        // Setup Kafka Consumer Properties
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA_BROKER);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "db-persister-group");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            consumer.subscribe(Arrays.asList("accept-events", "trade-events", "cancel-events"));
            System.out.println("Subscribed to accept-events, trade-events, cancel-events. Starting poll loop...");

            while (true) {
                try {
                    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
                    for (ConsumerRecord<String, String> record : records) {
                        processMessage(record.value());
                    }
                } catch (Exception e) {
                    System.err.println("Error in poll loop: " + e.getMessage());
                    try {
                        Thread.sleep(2000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
    }

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    private static void processMessage(String payload) {
        try {
            JsonNode jsonNode = mapper.readTree(payload);
            String type = jsonNode.get("type").asText();

            try (Connection conn = getConnection()) {
                conn.setAutoCommit(false); // Enable explicit transaction control
                try {
                    if ("ACCEPT".equals(type)) {
                        handleAccept(conn, jsonNode);
                    } else if ("TRADE".equals(type)) {
                        handleTrade(conn, jsonNode);
                    } else if ("CANCEL".equals(type)) {
                        handleCancel(conn, jsonNode);
                    }
                    conn.commit();
                } catch (Exception e) {
                    conn.rollback();
                    System.err.println("Transaction rolled back for event [" + type + "]. Error: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to process database event: " + e.getMessage());
        }
    }

    private static void handleAccept(Connection conn, JsonNode node) throws SQLException {
        long orderId = node.get("orderId").asLong();
        long userId = node.get("userId").asLong();
        String symbol = node.get("symbol").asText();
        String side = node.get("side").asText();
        long price = node.get("price").asLong();
        long qty = node.get("qty").asLong();
        long ts = node.get("ts").asLong();

        // 1. Insert order to DB
        String sqlOrder = "INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at) " +
                          "VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', TO_TIMESTAMP(? / 1000.0)) ON CONFLICT (order_id) DO NOTHING";
        try (PreparedStatement ps = conn.prepareStatement(sqlOrder)) {
            ps.setLong(1, orderId);
            ps.setLong(2, userId);
            ps.setString(3, symbol);
            ps.setString(4, side);
            ps.setLong(5, price);
            ps.setLong(6, qty);
            ps.setLong(7, qty);
            ps.setLong(8, ts);
            ps.executeUpdate();
        }

        // 2. Asset Hold (Locked Balance adjustment)
        String baseAsset = symbol.split("-")[0];
        String quoteAsset = symbol.split("-")[1];

        if ("BUY".equals(side)) {
            // BUY holds quoteAsset (e.g. KRW / USD)
            double requiredQuote = (price / 100.0) * qty;
            adjustBalance(conn, userId, quoteAsset, -requiredQuote, requiredQuote, "ORDER_HOLD", orderId);
        } else {
            // SELL holds baseAsset (e.g. BTC / ADA)
            double requiredBase = qty; // For crypto matching engine, qty is integer base asset amount
            adjustBalance(conn, userId, baseAsset, -requiredBase, requiredBase, "ORDER_HOLD", orderId);
        }

        System.out.printf("[ACCEPT] Order %d (User %d, %s %s @ %,d Qty %d) persisted.\n", orderId, userId, symbol, side, price, qty);
    }

    private static void handleTrade(Connection conn, JsonNode node) throws SQLException {
        long seq = node.get("seq").asLong();
        String symbol = node.get("symbol").asText();
        long takerOrderId = node.get("takerOrderId").asLong();
        long takerUserId = node.get("takerUserId").asLong();
        long makerOrderId = node.get("makerOrderId").asLong();
        long makerUserId = node.get("makerUserId").asLong();
        long price = node.get("price").asLong();
        long qty = node.get("qty").asLong();
        long ts = node.get("ts").asLong();

        double feeRate = getFeeRate(conn, symbol);
        double feeAmount = (price / 100.0 * qty) * feeRate;

        // 1. Insert Trade Event
        String sqlTrade = "INSERT INTO trades (trade_id, symbol, buy_order_id, sell_order_id, price, qty, fee_rate, fee_amount, executed_at) " +
                          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, TO_TIMESTAMP(? / 1000.0)) ON CONFLICT (trade_id) DO NOTHING";
        
        long buyOrderId = 0;
        long sellOrderId = 0;
        
        // Query to figure out sides of the orders
        String takerSide = getOrderSide(conn, takerOrderId);
        if ("BUY".equals(takerSide)) {
            buyOrderId = takerOrderId;
            sellOrderId = makerOrderId;
        } else {
            buyOrderId = makerOrderId;
            sellOrderId = takerOrderId;
        }

        try (PreparedStatement ps = conn.prepareStatement(sqlTrade)) {
            ps.setLong(1, seq);
            ps.setString(2, symbol);
            ps.setLong(3, buyOrderId);
            ps.setLong(4, sellOrderId);
            ps.setLong(5, price);
            ps.setLong(6, qty);
            ps.setDouble(7, feeRate);
            ps.setDouble(8, feeAmount);
            ps.setLong(9, ts);
            ps.executeUpdate();
        }

        // 2. Update Order quantities & states in DB
        updateOrderRemaining(conn, takerOrderId, qty);
        updateOrderRemaining(conn, makerOrderId, qty);

        // 3. Asset Settle (Transfer fund!)
        String baseAsset = symbol.split("-")[0];
        String quoteAsset = symbol.split("-")[1];

        double tradeQuoteQty = (price / 100.0) * qty;
        double tradeBaseQty = qty;

        // Buyer gets baseAsset (BTC/ADA) and pays quoteAsset (KRW/USD)
        long buyerUserId = "BUY".equals(takerSide) ? takerUserId : makerUserId;
        adjustBalance(conn, buyerUserId, quoteAsset, 0, -tradeQuoteQty, "TRADE_SETTLE", seq); // spent locked quote
        adjustBalance(conn, buyerUserId, baseAsset, tradeBaseQty, 0, "TRADE_SETTLE", seq); // got base

        // Seller gets quoteAsset (KRW/USD) and pays baseAsset (BTC/ADA)
        long sellerUserId = "SELL".equals(takerSide) ? takerUserId : makerUserId;
        adjustBalance(conn, sellerUserId, baseAsset, 0, -tradeBaseQty, "TRADE_SETTLE", seq); // spent locked base
        adjustBalance(conn, sellerUserId, quoteAsset, tradeQuoteQty, 0, "TRADE_SETTLE", seq); // got quote

        System.out.printf("[TRADE] Trade %d (Taker %d, Maker %d, Price %d, Qty %d) settled.\n", seq, takerOrderId, makerOrderId, price, qty);
    }

    private static void handleCancel(Connection conn, JsonNode node) throws SQLException {
        long orderId = node.get("orderId").asLong();
        long userId = node.get("userId").asLong();
        String symbol = node.get("symbol").asText();

        // 1. Find the cancelled order to refund remaining assets
        String sqlSelect = "SELECT side, price, remaining_qty FROM orders WHERE order_id = ?";
        String side = "";
        long price = 0;
        long remainingQty = 0;

        try (PreparedStatement ps = conn.prepareStatement(sqlSelect)) {
            ps.setLong(1, orderId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    side = rs.getString("side");
                    price = rs.getLong("price");
                    remainingQty = rs.getLong("remaining_qty");
                }
            }
        }

        if (remainingQty <= 0) {
            System.out.printf("[CANCEL] Order %d has already been completely filled. No refund needed.\n", orderId);
            return;
        }

        // 2. Set order status to CANCELLED
        String sqlUpdate = "UPDATE orders SET remaining_qty = 0, status = 'CANCELLED' WHERE order_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlUpdate)) {
            ps.setLong(1, orderId);
            ps.executeUpdate();
        }

        // 3. Release/Refund Locked Asset
        String baseAsset = symbol.split("-")[0];
        String quoteAsset = symbol.split("-")[1];

        if ("BUY".equals(side)) {
            // Refund KRW/USD
            double refundQuote = (price / 100.0) * remainingQty;
            adjustBalance(conn, userId, quoteAsset, refundQuote, -refundQuote, "CANCEL_RELEASE", orderId);
        } else {
            // Refund BTC/ADA
            double refundBase = remainingQty;
            adjustBalance(conn, userId, baseAsset, refundBase, -refundBase, "CANCEL_RELEASE", orderId);
        }

        System.out.printf("[CANCEL] Order %d (User %d, refunded %d remaining) successfully processed.\n", orderId, userId, remainingQty);
    }

    private static void adjustBalance(Connection conn, long userId, String currency, double deltaBalance, double deltaLocked, String type, long refId) throws SQLException {
        // Ensure wallet row exists first
        String sqlUpsert = "INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES (?, ?, 0.0, 0.0) ON CONFLICT (user_id, currency) DO NOTHING";
        try (PreparedStatement ps = conn.prepareStatement(sqlUpsert)) {
            ps.setLong(1, userId);
            ps.setString(2, currency);
            ps.executeUpdate();
        }

        // Adjust Balance
        String sqlAdjust = "UPDATE wallets SET balance = balance + ?, locked_balance = locked_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND currency = ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlAdjust)) {
            ps.setDouble(1, deltaBalance);
            ps.setDouble(2, deltaLocked);
            ps.setLong(3, userId);
            ps.setString(4, currency);
            ps.executeUpdate();
        }

        // Insert into Ledger Journal
        String sqlJournal = "INSERT INTO ledger_journal (user_id, currency, amount, type, reference_id) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sqlJournal)) {
            ps.setLong(1, userId);
            ps.setString(2, currency);
            ps.setDouble(3, deltaBalance + deltaLocked); // total net change in asset
            ps.setString(4, type);
            ps.setLong(5, refId);
            ps.executeUpdate();
        }
    }

    private static String getOrderSide(Connection conn, long orderId) throws SQLException {
        String sql = "SELECT side FROM orders WHERE order_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, orderId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("side");
                }
            }
        }
        return "BUY"; // fallback default
    }

    private static void updateOrderRemaining(Connection conn, long orderId, long tradeQty) throws SQLException {
        String sqlSelect = "SELECT remaining_qty FROM orders WHERE order_id = ?";
        long currentRemaining = 0;
        try (PreparedStatement ps = conn.prepareStatement(sqlSelect)) {
            ps.setLong(1, orderId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    currentRemaining = rs.getLong("remaining_qty");
                }
            }
        }

        long nextRemaining = Math.max(0, currentRemaining - tradeQty);
        String status = nextRemaining == 0 ? "FILLED" : "PARTIALLY_FILLED";

        String sqlUpdate = "UPDATE orders SET remaining_qty = ?, status = ? WHERE order_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlUpdate)) {
            ps.setLong(1, nextRemaining);
            ps.setString(2, status);
            ps.setLong(3, orderId);
            ps.executeUpdate();
        }
    }

    private static double getFeeRate(Connection conn, String symbol) {
        long now = System.currentTimeMillis();
        // 10초 주기로 DB에서 최신 설정값을 리로드
        if (now - lastFeeRatesLoadTs > 10000 || feeRatesCache.isEmpty()) {
            try {
                String sql = "SELECT symbol, fee_rate FROM market_fees";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                     ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        feeRatesCache.put(rs.getString("symbol"), rs.getDouble("fee_rate"));
                    }
                    lastFeeRatesLoadTs = now;
                }
            } catch (SQLException e) {
                System.err.println("Failed to load fee rates from database: " + e.getMessage());
            }
        }
        
        return feeRatesCache.computeIfAbsent(symbol, s -> {
            if ("ADA-KRW".equals(s)) {
                return 0.0005;
            } else {
                return 0.001;
            }
        });
    }
}
