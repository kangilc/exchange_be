package exchange.kafka.db;

import org.junit.jupiter.api.*;
import java.lang.reflect.Method;
import java.sql.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.testcontainers.containers.PostgreSQLContainer;

import static org.junit.jupiter.api.Assertions.*;

/**
 * DbPersisterRunner의 데이터베이스 정산 로직을 검증하는 통합 테스트 클래스입니다.
 * H2 DB 대신 로컬/도커의 PostgreSQL exchange_test DB를 사용합니다.
 */
public class DbPersisterRunnerTest {

    // PostgreSQLTestcontainers를 static 싱글톤 컨테이너로 선언하여 테스트 생명주기 전체에서 재사용함.
    private static final PostgreSQLContainer<?> postgres; // 가상 DB 컨테이너를 제어하는 객체 변수
    private static final String TEST_DB_URL; // 컨테이너로부터 획득한 동적 JDBC 주소 저장 변수
    private static final String TEST_DB_USER; // 가상 DB 접속용 계정명 저장 변수
    private static final String TEST_DB_PASSWORD; // 가상 DB 접속용 패스워드 저장 변수
    private static final ObjectMapper mapper = new ObjectMapper(); // JSON 파싱 및 생성을 위한 맵퍼 객체

    static {
        // 테스트 독립성과 격리성을 보장하기 위해 도커를 통한 가상 PostgreSQL 15-alpine 환경을 기동함.
        postgres = new PostgreSQLContainer<>("postgres:15-alpine")
                .withDatabaseName("exchange_test")
                .withUsername("postgres")
                .withPassword("postgres");
        postgres.start(); // 컨테이너 구동 실행

        TEST_DB_URL = postgres.getJdbcUrl(); // 실행된 컨테이너의 포트 매핑이 반영된 URL 주소 추출
        TEST_DB_USER = postgres.getUsername(); // 컨테이너 내부 데이터베이스 계정명 추출
        TEST_DB_PASSWORD = postgres.getPassword(); // 컨테이너 내부 데이터베이스 패스워드 추출

        // 테스트용 DB 환경 변수를 System Property로 지정하여 ConfigLoader가 읽도록 유도
        System.setProperty("DB_URL", TEST_DB_URL);
        System.setProperty("DB_USER", TEST_DB_USER);
        System.setProperty("DB_PASSWORD", TEST_DB_PASSWORD);
    }

    @BeforeAll
    public static void setupConfig() throws Exception {
        System.out.println("DEBUG: System property DB_URL = " + System.getProperty("DB_URL"));
        
        // Flyway를 통해 admin-api 모듈의 최신 스펙 마이그레이션 파일들을 읽어 exchange_test DB를 자동으로 구축합니다.
        org.flywaydb.core.Flyway flyway = org.flywaydb.core.Flyway.configure()
                .dataSource(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)
                .locations("filesystem:../admin-api/src/main/resources/db/migration")
                .cleanDisabled(false) // clean 기능 활성화
                .load();
        
        // 이전 테스트 잔재를 완전히 소거하고 스키마를 최신 상태로 재구축
        flyway.clean();
        flyway.migrate();
    }

    @BeforeEach
    public void clearDatabase() throws Exception {
        // DbPersisterRunner 내부의 10초 메모리 캐시(marketConfigCache)로 인해 테스트 케이스가 오염되는 현상을 원천 방어하기 위해 리플렉션으로 캐시와 시간값을 비움.
        try {
            java.lang.reflect.Field cacheField = DbPersisterRunner.class.getDeclaredField("marketConfigCache"); // 내부 캐시 맵 필드 객체 획득
            cacheField.setAccessible(true); // 필드 접근 제어 지시자 해제
            java.util.concurrent.ConcurrentHashMap<?, ?> cache = (java.util.concurrent.ConcurrentHashMap<?, ?>) cacheField.get(null); // static 필드 인스턴스 획득
            cache.clear(); // 마켓 설정 캐시 맵 전체 원소 소거

            java.lang.reflect.Field tsField = DbPersisterRunner.class.getDeclaredField("lastMarketConfigsLoadTs"); // 내부 타임스탬프 필드 객체 획득
            tsField.setAccessible(true); // 필드 접근 제어 지시자 해제
            tsField.set(null, 0L); // 캐시 유효 시간을 0초로 강제 리셋하여 다음 쿼리 호출 유도
        } catch (Exception e) {
            System.err.println("WARN: Failed to clear DbPersisterRunner static cache: " + e.getMessage());
        }

        // 테스트 케이스 수행 전 모든 데이터 클리어 및 초기 모의 데이터 적재
        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("TRUNCATE TABLE ledger_journal, trades, orders, wallets, markets, users RESTART IDENTITY CASCADE");
                
                // 테스트용 마켓 설정 주입
                stmt.execute("INSERT INTO markets (symbol, base_currency, quote_currency, fee_rate, price_decimals) " +
                        "VALUES ('BTC-USD', 'BTC', 'USD', 0.001000, 2)");
                stmt.execute("INSERT INTO markets (symbol, base_currency, quote_currency, fee_rate, price_decimals) " +
                        "VALUES ('ADA-KRW', 'ADA', 'KRW', 0.001500, 0)");

                // 일반 사용자 가등록
                stmt.execute("INSERT INTO users (user_id, email, password_hash, role) VALUES (100, 'buyer@test.com', 'hash', 'USER')");
                stmt.execute("INSERT INTO users (user_id, email, password_hash, role) VALUES (200, 'seller@test.com', 'hash', 'USER')");
                
                // 시스템 수수료 계정 등록
                stmt.execute("INSERT INTO users (user_id, email, password_hash, role) VALUES (1001, 'sys-fee-btc-usd@javaf.net', 'SYSTEM', 'SYSTEM')");
                stmt.execute("INSERT INTO users (user_id, email, password_hash, role) VALUES (1002, 'sys-fee-ada-krw@javaf.net', 'SYSTEM', 'SYSTEM')");

                // 테스트용 초기 지갑 자산 설정
                stmt.execute("INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES (100, 'USD', 100000.0, 0.0)");
                stmt.execute("INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES (200, 'BTC', 10.0, 0.0)");
                stmt.execute("INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES (100, 'KRW', 500000.0, 0.0)");
                stmt.execute("INSERT INTO wallets (user_id, currency, balance, locked_balance) VALUES (200, 'ADA', 10000.0, 0.0)");
            }
        }
    }

    private void invokeProcessMessage(String message) throws Exception {
        // 리플렉션을 통해 DbPersisterRunner의 private static 메서드 processMessage 호출
        Method method = DbPersisterRunner.class.getDeclaredMethod("processMessage", String.class);
        method.setAccessible(true);
        method.invoke(null, message);
    }

    @Test
    @DisplayName("기본 매수 주문 접수 (ACCEPT) 검증")
    public void testBasicOrderAcceptBuy() throws Exception {
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "ACCEPT");
        node.put("orderId", 1L);
        node.put("userId", 100L);
        node.put("symbol", "BTC-USD");
        node.put("side", "BUY");
        node.put("price", 6000000L); // 2 decimals -> $60,000.00
        node.put("qty", 1L);
        node.put("ts", System.currentTimeMillis());

        invokeProcessMessage(node.toString());

        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            // 주문이 정상 저장되었는지 검증
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM orders WHERE order_id = 1")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals("NEW", rs.getString("status"));
                    assertEquals(1, rs.getLong("remaining_qty"));
                }
            }

            // 구매자 지갑 잔고가 정상 잠금 처리되었는지 검증 (requiredQuote = 60000 * 1 = 60000)
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance, locked_balance FROM wallets WHERE user_id = 100 AND currency = 'USD'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(40000.0, rs.getDouble("balance")); // 100,000 - 60,000
                    assertEquals(60000.0, rs.getDouble("locked_balance"));
                }
            }
        }
    }

    @Test
    @DisplayName("기본 주문 취소 (CANCEL) 검증")
    public void testBasicOrderCancel() throws Exception {
        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status) " +
                        "VALUES (5, 100, 'BTC-USD', 'BUY', 6000000, 1, 1, 'NEW')");
                stmt.execute("UPDATE wallets SET balance = 40000.0, locked_balance = 60000.0 WHERE user_id = 100 AND currency = 'USD'");
            }
        }

        ObjectNode node = mapper.createObjectNode();
        node.put("type", "CANCEL");
        node.put("orderId", 5L);
        node.put("userId", 100L);
        node.put("symbol", "BTC-USD");

        invokeProcessMessage(node.toString());

        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            // 주문 상태가 CANCELLED로 변경되었는지 검증
            try (PreparedStatement ps = conn.prepareStatement("SELECT * FROM orders WHERE order_id = 5")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals("CANCELLED", rs.getString("status"));
                    assertEquals(0, rs.getLong("remaining_qty"));
                }
            }

            // 잠금 상태인 잔고가 정상 복구되었는지 검증
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance, locked_balance FROM wallets WHERE user_id = 100 AND currency = 'USD'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(100000.0, rs.getDouble("balance"));
                    assertEquals(0.0, rs.getDouble("locked_balance"));
                }
            }
        }
    }

    @Test
    @DisplayName("기본 체결 정산, 수수료 차감 및 마켓별 시스템 계정 적립 검증")
    public void testBasicTradeSettlementAndFees() throws Exception {
        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            try (Statement stmt = conn.createStatement()) {
                // 매수자 주문 적재 및 잔고 잠금
                stmt.execute("INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status) " +
                        "VALUES (10, 100, 'BTC-USD', 'BUY', 6000000, 1, 1, 'NEW')");
                stmt.execute("UPDATE wallets SET balance = 40000.0, locked_balance = 60000.0 WHERE user_id = 100 AND currency = 'USD'");

                // 매도자 주문 적재 및 잔고 잠금
                stmt.execute("INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status) " +
                        "VALUES (20, 200, 'BTC-USD', 'SELL', 6000000, 1, 1, 'NEW')");
                stmt.execute("UPDATE wallets SET balance = 0.0, locked_balance = 1.0 WHERE user_id = 200 AND currency = 'BTC'");
            }
        }

        // 체결 이벤트 전송 (수수료 0.1% -> $60,000 * 0.001 = $60.00)
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "TRADE");
        node.put("seq", 500L);
        node.put("symbol", "BTC-USD");
        node.put("takerOrderId", 10L);
        node.put("takerUserId", 100L);
        node.put("makerOrderId", 20L);
        node.put("makerUserId", 200L);
        node.put("price", 6000000L);
        node.put("qty", 1L);
        node.put("ts", System.currentTimeMillis());

        invokeProcessMessage(node.toString());

        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            // 양측 주문이 모두 FILLED 상태가 되었는지 확인
            try (PreparedStatement ps = conn.prepareStatement("SELECT remaining_qty, status FROM orders WHERE order_id IN (10, 20)")) {
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        assertEquals(0, rs.getLong("remaining_qty"));
                        assertEquals("FILLED", rs.getString("status"));
                    }
                }
            }

            // 구매자 지갑 검증 (USD $60,000 차감, 1 BTC 증가, 수수료 $60 차감)
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance, locked_balance FROM wallets WHERE user_id = 100 AND currency = 'USD'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(40000.0 - 60.0, rs.getDouble("balance"));
                    assertEquals(0.0, rs.getDouble("locked_balance"));
                }
            }
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance FROM wallets WHERE user_id = 100 AND currency = 'BTC'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(1.0, rs.getDouble("balance"));
                }
            }

            // 판매자 지갑 검증 (1 BTC 잠금 해제/차감, $60,000 입금)
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance, locked_balance FROM wallets WHERE user_id = 200 AND currency = 'USD'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(60000.0, rs.getDouble("balance"));
                }
            }

            // 시스템 수수료 지갑 적립 검증 (BTC-USD 마켓 수수료 계정 1001번으로 $60 적립)
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance FROM wallets WHERE user_id = 1001 AND currency = 'USD'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(60.0, rs.getDouble("balance"));
                }
            }
        }
    }

    @Test
    @DisplayName("코인 소수점 자릿수 동적 처리 검증")
    public void testDynamicPriceDecimals() throws Exception {
        // ADA 마켓은 price_decimals = 0이므로 scale 적용 없이 500원이 실제 500원임
        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            try (Statement stmt = conn.createStatement()) {
                stmt.execute("INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status) " +
                        "VALUES (11, 100, 'ADA-KRW', 'BUY', 500, 10, 10, 'NEW')");
                // requiredQuote = 500 * 10 = 5000원 잠금
                stmt.execute("UPDATE wallets SET balance = 495000.0, locked_balance = 5000.0 WHERE user_id = 100 AND currency = 'KRW'");

                stmt.execute("INSERT INTO orders (order_id, user_id, symbol, side, price, qty, remaining_qty, status) " +
                        "VALUES (21, 200, 'ADA-KRW', 'SELL', 500, 10, 10, 'NEW')");
                stmt.execute("UPDATE wallets SET balance = 0.0, locked_balance = 10.0 WHERE user_id = 200 AND currency = 'ADA'");
            }
        }

        // 수수료율 0.0015 -> 5000원 * 0.0015 = 7.5원 수수료 발생
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "TRADE");
        node.put("seq", 501L);
        node.put("symbol", "ADA-KRW");
        node.put("takerOrderId", 11L);
        node.put("takerUserId", 100L);
        node.put("makerOrderId", 21L);
        node.put("makerUserId", 200L);
        node.put("price", 500L);
        node.put("qty", 10L);
        node.put("ts", System.currentTimeMillis());

        invokeProcessMessage(node.toString());

        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            // 매수자 잔액에서 수수료 7.5원이 차감되었는지 확인
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance FROM wallets WHERE user_id = 100 AND currency = 'KRW'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(495000.0 - 7.5, rs.getDouble("balance"));
                }
            }

            // ADA-KRW 전용 시스템 계정(1002번)으로 7.5원이 적립되었는지 확인
            try (PreparedStatement ps = conn.prepareStatement("SELECT balance FROM wallets WHERE user_id = 1002 AND currency = 'KRW'")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(7.5, rs.getDouble("balance"));
                }
            }
        }
    }

    @Test
    @DisplayName("이벤트 중복 처리(멱등성) 검증")
    public void testIdempotentEventHandling() throws Exception {
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "ACCEPT");
        node.put("orderId", 100L);
        node.put("userId", 100L);
        node.put("symbol", "BTC-USD");
        node.put("side", "BUY");
        node.put("price", 6000000L);
        node.put("qty", 1L);
        node.put("ts", System.currentTimeMillis());

        // 1차 전송
        invokeProcessMessage(node.toString());
        
        // 2차 중복 전송
        invokeProcessMessage(node.toString());

        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            // 주문이 유니크하게 1개만 생성되어야 함
            try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM orders WHERE order_id = 100")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(1, rs.getInt(1));
                }
            }
        }
    }

    @Test
    @DisplayName("데이터베이스 에러 발생 시 원자적 트랜잭션 롤백 검증")
    public void testTransactionRollbackOnError() throws Exception {
        // 존재하지 않는 유저에 대한 비정상적인 주문 전송으로 트랜잭션 에러 유발
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "ACCEPT");
        node.put("orderId", 9999L);
        node.put("userId", 999L);
        node.put("symbol", "BTC-USD-TOO-LONG-SYMBOL-THAT-WILL-EXCEED-VARCHAR-LIMIT-AND-TRIGGER-DB-ERROR");
        node.put("side", "BUY");
        node.put("price", 6000000L);
        node.put("qty", 1L);
        node.put("ts", System.currentTimeMillis());

        invokeProcessMessage(node.toString());

        try (Connection conn = DriverManager.getConnection(TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD)) {
            // 트랜잭션이 롤백되어 주문 내역이 남지 않았는지 검증
            try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM orders WHERE order_id = 9999")) {
                try (ResultSet rs = ps.executeQuery()) {
                    assertTrue(rs.next());
                    assertEquals(0, rs.getInt(1));
                }
            }
        }
    }
}
