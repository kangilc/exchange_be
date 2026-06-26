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
import exchange.kafka.KafkaConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.Duration;
import java.util.Arrays;
import java.util.Properties;

/**
 * Kafka 이벤트를 구독하여 데이터베이스(PostgreSQL)에 주문, 체결, 취소 정보를 지속성 있게 기록하고,
 * 이에 따른 유저의 자산 변동(잔액 차감, 잠금 설정, 정산) 및 회계 원장(ledger_journal) 기록을 수행하는 핵심 정산기
 */
public final class DbPersisterRunner {
    private static final Logger log = LoggerFactory.getLogger(DbPersisterRunner.class);
    // 설정 파일 로더로부터 DB 및 Kafka 연결 정보를 읽어옵니다.
    private static final String KAFKA_BROKER = ConfigLoader.get("KAFKA_BROKER", "localhost:9092");
    private static final String DB_URL = ConfigLoader.get("DB_URL", "jdbc:postgresql://localhost:5432/exchange");
    private static final String DB_USER = ConfigLoader.get("DB_USER", "postgres");
    private static final String DB_PASSWORD = ConfigLoader.get("DB_PASSWORD", "postgres");

    // JSON 파싱을 위한 ObjectMapper 인스턴스
    private static final ObjectMapper mapper = new ObjectMapper();

    // 마켓 설정 정보를 보관하는 동시성 해시맵
    private static final java.util.concurrent.ConcurrentHashMap<String, MarketConfig> marketConfigCache = new java.util.concurrent.ConcurrentHashMap<>();
    // DB의 최신 마켓 정보를 마지막으로 조회한 시각 (밀리초)
    private static volatile long lastMarketConfigsLoadTs = 0;
    // 마켓별 시스템 수수료 수계 계정 ID를 캐싱하는 동시성 해시맵
    private static final java.util.concurrent.ConcurrentHashMap<String, Long> systemFeeUserIdCache = new java.util.concurrent.ConcurrentHashMap<>();

    public static void main(String[] args) {
        log.info("==================================================");
        log.info("  🌌 HIGH-PERFORMANCE DB SETTLEMENT PERSISTER  ");
        log.info("==================================================");
        log.info("Connecting to database: {}", DB_URL);
        log.info("Kafka Broker          : {}", KAFKA_BROKER);

        // 프로그램 시작 시 DB 연결 가능 여부를 사전에 테스트(웜업)
        try (Connection conn = getConnection()) {
            log.info("Successfully connected to PostgreSQL database!");
        } catch (Exception e) {
            log.error("Database connection failed. Persister will retry continuously: {}", e.getMessage());
        }

        // Kafka 컨슈머 구성
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, KAFKA_BROKER);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "db-persister-group");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        // 처음 구동 시 가장 첫 오프셋부터(earliest) 이벤트를 읽어옴
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        // 자동 커밋을 켬
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");

        try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
            // 접수(accept), 체결(trade), 취소(cancel) 토픽을 구독
            consumer.subscribe(Arrays.asList(KafkaConfig.TOPIC_ACCEPT, KafkaConfig.TOPIC_TRADE, KafkaConfig.TOPIC_CANCEL));
            log.info("Subscribed to {}, {}, {}. Starting poll loop...", 
                    KafkaConfig.TOPIC_ACCEPT, KafkaConfig.TOPIC_TRADE, KafkaConfig.TOPIC_CANCEL);

            // Kafka로부터 이벤트를 가져오는 메인 폴링(Poll) 루프
            while (true) {
                try {
                    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
                    for (ConsumerRecord<String, String> record : records) {
                        processMessage(record.value());
                    }
                } catch (Exception e) {
                    log.error("Error in poll loop: ", e);
                    try {
                        Thread.sleep(2000); // 에러 발생 시 2초 대기 후 루프 재개
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }
    }

    /**
     * DB 연결 객체를 획득합니다.
     * 
     * @return Connection 객체
     * @throws SQLException DB 연결 예외
     */
    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    /**
     * Kafka에서 받은 단일 JSON 메시지를 파싱하여 비즈니스 로직으로 분기
     * 원자적 트랜잭션 처리를 위해 수동 커밋 모드(setAutoCommit(false))로 처리하며 에러 시 롤백
     * 
     * @param payload JSON 형식의 메시지 바디
     */
    private static void processMessage(String payload) {
        try {
            JsonNode jsonNode = mapper.readTree(payload);
            String type = jsonNode.get("type").asText();

            try (Connection conn = getConnection()) {
                conn.setAutoCommit(false); // 명시적 트랜잭션 제어 활성화
                try {
                    if ("ACCEPT".equals(type)) {
                        handleAccept(conn, jsonNode);
                    } else if ("TRADE".equals(type)) {
                        handleTrade(conn, jsonNode);
                    } else if ("CANCEL".equals(type)) {
                        handleCancel(conn, jsonNode);
                    }
                    conn.commit(); // 문제 없을 경우 트랜잭션 커밋
                } catch (Exception e) {
                    conn.rollback(); // 예외 발생 시 전면 롤백
                    System.err.println("Transaction rolled back for event [" + type + "]. Error: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to process database event: " + e.getMessage());
        }
    }

    /**
     * 신규 주문이 매칭 엔진에 성공적으로 접수(ACCEPT)되었을 때 호출됩니다.
     * 1. orders 테이블에 신규 주문 정보를 기록합니다.
     * 2. 주문한 수량/금액에 맞춰 사용자의 자산(Balance)을 사용 불가 처리하고 Lock(locked_balance)합니다.
     */
    private static void handleAccept(Connection conn, JsonNode node) throws SQLException {
        long orderId = node.get("orderId").asLong();
        long userId = node.get("userId").asLong();
        String symbol = node.get("symbol").asText();
        String side = node.get("side").asText();
        long price = node.get("price").asLong();
        long qty = node.get("qty").asLong();
        long ts = node.get("ts").asLong();

        // 1. orders 테이블에 주문 추가 (중복 인서트 발생 시 무시)
        String sqlOrder = "INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status, created_at) "
                +
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

        // 2. 자산 잠금(Hold) 처리
        String baseAsset = symbol.split("-")[0]; // 예: BTC-USD 에서 BTC
        String quoteAsset = symbol.split("-")[1]; // 예: BTC-USD 에서 USD

        MarketConfig config = getMarketConfig(conn, symbol);
        double divisor = Math.pow(10, config.priceDecimals);

        if ("BUY".equals(side)) {
            // 매수(BUY) 주문 시: 가격(소수점 자릿수 고려) * 수량 만큼 결제 자산(quote)을 잠금
            double requiredQuote = (price / divisor) * qty;
            adjustBalance(conn, userId, quoteAsset, -requiredQuote, requiredQuote, "ORDER_HOLD", orderId);
        } else {
            // 매도(SELL) 주문 시: 주문 수량만큼 기초 자산(base)을 잠금
            double requiredBase = qty;
            adjustBalance(conn, userId, baseAsset, -requiredBase, requiredBase, "ORDER_HOLD", orderId);
        }

        log.info("[ACCEPT] Order {} (User {}, {} {} @ {}, Qty {}) persisted.", orderId, userId, symbol, side,
                price, qty);
    }

    /**
     * 두 주문이 체결(TRADE)되었을 때 호출됨.
     * 1. trades 테이블에 체결 세부 내역을 영속화
     * 2. 체결된 수량만큼 매수 및 매도 주문의 남은 수량(remaining_qty)을 차감하고 상태(status)를 갱신
     * 3. 구매자와 판매자 간 자산 교환 정산(Settle)을 진행하고, 회계 장부(ledger_journal)를 작성
     */
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

        // 수수료율 및 소수점 자리 계산
        MarketConfig config = getMarketConfig(conn, symbol);
        double divisor = Math.pow(10, config.priceDecimals);
        double feeRate = config.feeRate;
        double feeAmount = (price / divisor * qty) * feeRate;

        // 1. 체결 이벤트 저장
        String sqlTrade = "INSERT INTO trades (trade_id, symbol, buy_order_id, sell_order_id, price, qty, fee_rate, fee_amount, created_at) "
                +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, TO_TIMESTAMP(? / 1000.0)) ON CONFLICT (trade_id) DO NOTHING";

        long buyOrderId = 0;
        long sellOrderId = 0;

        // Taker 주문의 side를 조회하여 각각 매수/매도 주문 매핑
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

        // 2. 주문 수량 차감 및 상태 변경 (FILLED, PARTIALLY_FILLED)
        updateOrderRemaining(conn, takerOrderId, qty);
        updateOrderRemaining(conn, makerOrderId, qty);

        // 3. 자산 교환 정산 및 전송
        String baseAsset = symbol.split("-")[0];
        String quoteAsset = symbol.split("-")[1];

        double tradeQuoteQty = (price / divisor) * qty;
        double tradeBaseQty = qty;

        // 구매자(Buyer) 처리: 잠금되어 있던 결제 자산(quote) 차감 및 획득한 기초 자산(base) 가산
        long buyerUserId = "BUY".equals(takerSide) ? takerUserId : makerUserId;
        adjustBalance(conn, buyerUserId, quoteAsset, 0, -tradeQuoteQty, "TRADE_SETTLE", seq);
        adjustBalance(conn, buyerUserId, baseAsset, tradeBaseQty, 0, "TRADE_SETTLE", seq);

        // 판매자(Seller) 처리: 잠금되어 있던 기초 자산(base) 차감 및 획득한 결제 자산(quote) 가산
        long sellerUserId = "SELL".equals(takerSide) ? takerUserId : makerUserId;
        adjustBalance(conn, sellerUserId, baseAsset, 0, -tradeBaseQty, "TRADE_SETTLE", seq);
        adjustBalance(conn, sellerUserId, quoteAsset, tradeQuoteQty, 0, "TRADE_SETTLE", seq);

        // 수수료 차감 및 시스템 계정 적립 (구매자가 지불)
        if (feeAmount > 0) {
            adjustBalance(conn, buyerUserId, quoteAsset, -feeAmount, 0, "FEE_PAID", seq);
            long systemFeeUserId = getSystemFeeUserId(conn, symbol);
            adjustBalance(conn, systemFeeUserId, quoteAsset, feeAmount, 0, "FEE_REVENUE", seq);
        }

        log.info("[TRADE] Trade {} (Taker {}, Maker {}, Price {}, Qty {}) settled.", seq, takerOrderId,
                makerOrderId, price, qty);
    }

    /**
     * 마켓별 시스템 수수료 수급용 계정의 user_id를 조회 (메모리 캐싱 적용)
     */
    private static long getSystemFeeUserId(Connection conn, String symbol) throws SQLException {
        // 1. 메모리 캐시에 존재할 경우 DB 조회 없이 즉시 반환 (O(1))
        if (systemFeeUserIdCache.containsKey(symbol)) {
            return systemFeeUserIdCache.get(symbol);
        }

        // 2. 캐시되지 않은 경우 DB 조회 후 캐시 저장
        String email = "sys-fee-" + symbol.toLowerCase() + "@javaf.net";
        String sql = "SELECT user_id FROM users WHERE email = ?";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    long userId = rs.getLong("user_id");
                    systemFeeUserIdCache.put(symbol, userId);
                    return userId;
                }
            }
        }

        // 3. DB에 없을 경우 기본 폴백 ID 처리 후 캐시 저장
        long fallbackId = "BTC-USD".equalsIgnoreCase(symbol) ? 1001L : 1002L;
        systemFeeUserIdCache.put(symbol, fallbackId);
        return fallbackId;
    }

    /**
     * 사용자가 주문을 취소(CANCEL)했을 때 호출
     * 1. 해당 주문의 미체결 잔여 수량(remaining_qty)을 파악하여 상태를 CANCELLED로 변경
     * 2. 미체결 수량만큼 잠겨 있던 사용자 자산을 해제(locked_balance -> balance 복원)
     */
    private static void handleCancel(Connection conn, JsonNode node) throws SQLException {
        long orderId = node.get("orderId").asLong();
        long userId = node.get("userId").asLong();
        String symbol = node.get("symbol").asText();

        // 1. 취소 대상 주문의 잔여 수량 파악
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

        // 이미 전량 체결된 주문일 경우 복원 불필요
        if (remainingQty <= 0) {
            System.out.printf("[CANCEL] Order %d has already been completely filled. No refund needed.\n", orderId);
            return;
        }

        // 2. 주문 상태를 CANCELLED로 업데이트
        String sqlUpdate = "UPDATE orders SET remaining_qty = 0, status = 'CANCELLED' WHERE order_id = ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlUpdate)) {
            ps.setLong(1, orderId);
            ps.executeUpdate();
        }

        // 3. 잠겨 있던 자산 반환(Release)
        String baseAsset = symbol.split("-")[0];
        String quoteAsset = symbol.split("-")[1];

        MarketConfig config = getMarketConfig(conn, symbol);
        double divisor = Math.pow(10, config.priceDecimals);

        if ("BUY".equals(side)) {
            // 매수 주문 취소 시: 남은 수량에 해당되는 결제자산(quote) 잠금 해제
            double refundQuote = (price / divisor) * remainingQty;
            adjustBalance(conn, userId, quoteAsset, refundQuote, -refundQuote, "CANCEL_RELEASE", orderId);
        } else {
            // 매도 주문 취소 시: 남은 수량만큼의 코인/기초자산(base) 잠금 해제
            double refundBase = remainingQty;
            adjustBalance(conn, userId, baseAsset, refundBase, -refundBase, "CANCEL_RELEASE", orderId);
        }

        log.info("[CANCEL] Order {} (User {}, refunded {} remaining) successfully processed.", orderId,
                userId, remainingQty);
    }

    /**
     * 사용자의 지갑 잔고를 차감/증가시키고, 해당 기록에 대해 회계 감사용 원장(ledger_journal)을 기록
     * 
     * @param conn         DB Connection
     * @param userId       유저 고유 ID
     * @param currency     화폐 종류 (BTC, KRW, USD 등)
     * @param deltaBalance 자유 잔고 변동값 (+ 또는 -)
     * @param deltaLocked  잠금 잔고 변동값 (+ 또는 -)
     * @param type         사유 유형 (ORDER_HOLD, TRADE_SETTLE, CANCEL_RELEASE 등)
     * @param refId        참조 대상 고유 ID (주문 ID 또는 체결 일련번호 등)
     * @throws SQLException SQL 실행 시 발생하는 예외
     */
    private static void adjustBalance(Connection conn, long userId, String currency, double deltaBalance,
            double deltaLocked, String type, long refId) throws SQLException {
        // 지갑 레코드가 미존재할 경우 Lazy하게 0값으로 먼저 생성 (ON CONFLICT DO NOTHING)
        String sqlUpsert = "INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES (?, ?, 0.0, 0.0) ON CONFLICT (user_id, currency) DO NOTHING";
        try (PreparedStatement ps = conn.prepareStatement(sqlUpsert)) {
            ps.setLong(1, userId);
            ps.setString(2, currency);
            ps.executeUpdate();
        }

        // 실제 지갑 잔고 업데이트 수행
        String sqlAdjust = "UPDATE wallets SET balance = balance + ?, locked_balance = locked_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND currency = ?";
        try (PreparedStatement ps = conn.prepareStatement(sqlAdjust)) {
            ps.setDouble(1, deltaBalance);
            ps.setDouble(2, deltaLocked);
            ps.setLong(3, userId);
            ps.setString(4, currency);
            ps.executeUpdate();
        }

        // 회계 감사(Ledger Journal) 테이블에 내역 기록
        String sqlJournal = "INSERT INTO ledger_journal (user_id, currency, amount, type, reference_id) VALUES (?, ?, ?, ?, ?)";
        try (PreparedStatement ps = conn.prepareStatement(sqlJournal)) {
            ps.setLong(1, userId);
            ps.setString(2, currency);
            ps.setDouble(3, deltaBalance + deltaLocked); // 순수하게 변동된 자산 총량 (자유 잔고 + 잠금 잔고 변동액 합산)
            ps.setString(4, type);
            ps.setLong(5, refId);
            ps.executeUpdate();
        }
    }

    /**
     * orders 테이블에서 특정 주문의 주문 구분(side: BUY/SELL)을 조회
     */
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

    /**
     * 체결 발생 시 주문의 잔여 수량을 업데이트하고 완전히 체결되었을 시 FILLED, 미달 시 PARTIALLY_FILLED 처리
     */
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

    private static class MarketConfig {
        final double feeRate;
        final int priceDecimals;

        MarketConfig(double feeRate, int priceDecimals) {
            this.feeRate = feeRate;
            this.priceDecimals = priceDecimals;
        }
    }

    /**
     * DB의 markets 테이블에서 실시간 마켓 설정(수수료율, 소수점 자릿수)을 캐싱 및 제공
     * 매 10초 주기로 DB 쿼리를 다시 실행하여 캐시 맵을 갱신(리로드)
     * 
     * @param conn   DB Connection
     * @param symbol 마켓 구분자 (예: BTC-USD)
     * @return 마켓 설정 정보 (없을 경우 기본값 수수료율 0.001, 소수점 2자리)
     */
    private static MarketConfig getMarketConfig(Connection conn, String symbol) {
        long now = System.currentTimeMillis();
        // 10초 주기로 DB에서 최신 설정값을 리로드하여 메모리 캐시 최신화
        if (now - lastMarketConfigsLoadTs > 10000 || marketConfigCache.isEmpty()) {
            try {
                String sql = "SELECT symbol, fee_rate, price_decimals FROM markets";
                try (PreparedStatement ps = conn.prepareStatement(sql);
                        ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String sym = rs.getString("symbol");
                        double feeRate = rs.getDouble("fee_rate");
                        int priceDecimals = rs.getInt("price_decimals");
                        if (rs.wasNull()) {
                            priceDecimals = 2; // 안전한 기본값
                        }
                        marketConfigCache.put(sym, new MarketConfig(feeRate, priceDecimals));
                    }
                    lastMarketConfigsLoadTs = now;
                }
            } catch (SQLException e) {
                log.error("Failed to load market configs from database: {}", e.getMessage());
            }
        }

        return marketConfigCache.getOrDefault(symbol, new MarketConfig(0.001, 2));
    }
}
