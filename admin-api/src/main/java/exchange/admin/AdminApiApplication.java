package exchange.admin;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;

@Slf4j
@SpringBootApplication
@EnableScheduling
public class AdminApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminApiApplication.class, args);
    }

    @Bean
    @Profile({"local", "dev"}) // dev, local 프로파일에서만 활성화
    public CommandLineRunner initDatabaseAndSeed(
            DataSource dataSource,
            exchange.admin.service.UserService userService,
            exchange.admin.repository.UserRepository userRepository) {
        return args -> {
            log.info("Running automatic database schema validation...");
            Connection conn = null;
            int maxRetries = 15;
            int retryCount = 0;
            while (retryCount < maxRetries) {
                try {
                    conn = dataSource.getConnection();
                    break;
                } catch (Exception e) {
                    retryCount++;
                    log.warn("Database is not ready yet (attempt {}/{}). Retrying in 2 seconds...", retryCount, maxRetries);
                    try {
                        Thread.sleep(2000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Database initialization interrupted", ie);
                    }
                }
            }
            if (conn == null) {
                log.error("Failed to connect to the database after {} retries. Schema validation and seeding aborted.", maxRetries);
                return;
            }

            try (Connection connection = conn) {
                DatabaseMetaData metaData = connection.getMetaData();
                
                // 1. Check 'grade' column
                boolean columnExists = false;
                try (ResultSet rs = metaData.getColumns(null, null, "users", "grade")) {
                    if (rs.next()) {
                        columnExists = true;
                    }
                }
                
                if (!columnExists) {
                    try (ResultSet rs = metaData.getColumns(null, null, "USERS", "GRADE")) {
                        if (rs.next()) {
                            columnExists = true;
                        }
                    }
                }

                if (!columnExists) {
                    log.info("Column 'grade' does not exist in 'users' table. Running ALTER TABLE statement...");
                    try (Statement stmt = connection.createStatement()) {
                        stmt.execute("ALTER TABLE users ADD COLUMN grade VARCHAR(20) DEFAULT 'STANDARD'");
                        log.info("Column 'grade' added to 'users' table successfully!");
                    }
                } else {
                    log.info("Column 'grade' already exists in 'users' table.");
                }

                // 2. Check 'refresh_token' column
                boolean tokenColumnExists = false;
                try (ResultSet rs = metaData.getColumns(null, null, "users", "refresh_token")) {
                    if (rs.next()) {
                        tokenColumnExists = true;
                    }
                }
                
                if (!tokenColumnExists) {
                    try (ResultSet rs = metaData.getColumns(null, null, "USERS", "REFRESH_TOKEN")) {
                        if (rs.next()) {
                            tokenColumnExists = true;
                        }
                    }
                }

                if (!tokenColumnExists) {
                    log.info("Column 'refresh_token' does not exist in 'users' table. Running ALTER TABLE statement...");
                    try (Statement stmt = connection.createStatement()) {
                        stmt.execute("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(512)");
                        log.info("Column 'refresh_token' added to 'users' table successfully!");
                    }
                } else {
                    log.info("Column 'refresh_token' already exists in 'users' table.");
                }

                // 3. 다중 테이블 공통 오디팅 컬럼 검증 및 생성 (users, wallets, ledger_journal, crypto_withdrawals, user_crypto_addresses, system_hot_wallets, trades)
                String[] tables = {"users", "wallets", "ledger_journal", "crypto_withdrawals", "user_crypto_addresses", "system_hot_wallets", "trades"};
                for (String table : tables) {
                    // created_at (trades와 user_crypto_addresses, ledger_journal 등의 기존 룰 매핑 및 생성)
                    boolean createdAtExists = false;
                    try (ResultSet rs = metaData.getColumns(null, null, table, "created_at")) {
                        if (rs.next()) createdAtExists = true;
                    }
                    if (!createdAtExists) {
                        try (Statement stmt = connection.createStatement()) {
                            stmt.execute("ALTER TABLE " + table + " ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
                            log.info("Column 'created_at' added to '" + table + "' table successfully!");
                        }
                    }

                    // updated_at
                    boolean updatedAtExists = false;
                    try (ResultSet rs = metaData.getColumns(null, null, table, "updated_at")) {
                        if (rs.next()) updatedAtExists = true;
                    }
                    if (!updatedAtExists) {
                        try (Statement stmt = connection.createStatement()) {
                            stmt.execute("ALTER TABLE " + table + " ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
                            log.info("Column 'updated_at' added to '" + table + "' table successfully!");
                        }
                    }

                    // created_by
                    boolean createdByExists = false;
                    try (ResultSet rs = metaData.getColumns(null, null, table, "created_by")) {
                        if (rs.next()) createdByExists = true;
                    }
                    if (!createdByExists) {
                        try (Statement stmt = connection.createStatement()) {
                            stmt.execute("ALTER TABLE " + table + " ADD COLUMN created_by VARCHAR(100)");
                            log.info("Column 'created_by' added to '" + table + "' table successfully!");
                        }
                    }

                    // updated_by
                    boolean updatedByExists = false;
                    try (ResultSet rs = metaData.getColumns(null, null, table, "updated_by")) {
                        if (rs.next()) updatedByExists = true;
                    }
                    if (!updatedByExists) {
                        try (Statement stmt = connection.createStatement()) {
                            stmt.execute("ALTER TABLE " + table + " ADD COLUMN updated_by VARCHAR(100)");
                            log.info("Column 'updated_by' added to '" + table + "' table successfully!");
                        }
                    }
                }

                // 4. 하드코딩된 시드 데이터로 인해 어긋난 users_user_id_seq 시퀀스를 테이블 최댓값에 맞게 자동 동기화 처리함 (중복 키 오류 방지용)
                log.info("Synchronizing users_user_id_seq sequence...");
                try (Statement stmt = connection.createStatement()) {
                    stmt.execute("SELECT setval('users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM users), 0) + 1, false)");
                    log.info("users_user_id_seq sequence synchronized successfully!");
                }

                // 4.5. market_fees 테이블 검증 및 생성
                log.info("Validating 'market_fees' table...");
                boolean marketFeesTableExists = false;
                try (ResultSet rs = metaData.getTables(null, null, "market_fees", null)) {
                    if (rs.next()) marketFeesTableExists = true;
                }
                if (!marketFeesTableExists) {
                    try (ResultSet rs = metaData.getTables(null, null, "MARKET_FEES", null)) {
                        if (rs.next()) marketFeesTableExists = true;
                    }
                }
                if (!marketFeesTableExists) {
                    log.info("Table 'market_fees' does not exist. Creating and seeding it...");
                    try (Statement stmt = connection.createStatement()) {
                        stmt.execute("CREATE TABLE market_fees (" +
                                "symbol VARCHAR(20) PRIMARY KEY, " +
                                "fee_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.001000)");
                        stmt.execute("INSERT INTO market_fees (symbol, fee_rate) VALUES " +
                                "('BTC-USD', 0.001000), " +
                                "('ADA-KRW', 0.000500) " +
                                "ON CONFLICT (symbol) DO NOTHING");
                        log.info("Table 'market_fees' created and seeded successfully!");
                    }
                } else {
                    log.info("Table 'market_fees' already exists.");
                }

                // 4.6. trades 테이블의 fee_rate 및 fee_amount 컬럼 존재 검사 및 추가
                log.info("Validating 'trades' table fee columns...");
                boolean feeRateExists = false;
                boolean feeAmountExists = false;
                try (ResultSet rs = metaData.getColumns(null, null, "trades", "fee_rate")) {
                    if (rs.next()) feeRateExists = true;
                }
                try (ResultSet rs = metaData.getColumns(null, null, "trades", "fee_amount")) {
                    if (rs.next()) feeAmountExists = true;
                }
                if (!feeRateExists) {
                    try (Statement stmt = connection.createStatement()) {
                        stmt.execute("ALTER TABLE trades ADD COLUMN fee_rate NUMERIC(10, 6) DEFAULT 0.0");
                        log.info("Column 'fee_rate' added to 'trades' table successfully!");
                    }
                }
                if (!feeAmountExists) {
                    try (Statement stmt = connection.createStatement()) {
                        stmt.execute("ALTER TABLE trades ADD COLUMN fee_amount NUMERIC(36, 18) DEFAULT 0.0");
                        log.info("Column 'fee_amount' added to 'trades' table successfully!");
                    }
                }

                // 4.7. 기존 거래 내역의 수수료 소급 계산 마이그레이션
                log.info("Backfilling trade fee values for older records...");
                try (Statement stmt = connection.createStatement()) {
                    // Backfill fee_rate from market_fees
                    stmt.execute("UPDATE trades SET fee_rate = COALESCE(" +
                            "(SELECT fee_rate FROM market_fees WHERE market_fees.symbol = trades.symbol), " +
                            "CASE WHEN symbol = 'ADA-KRW' THEN 0.000500 ELSE 0.001000 END) " +
                            "WHERE fee_rate = 0.0 OR fee_rate IS NULL");
                    
                    // Backfill fee_amount
                    stmt.execute("UPDATE trades SET fee_amount = (price / 100.0 * qty) * fee_rate " +
                            "WHERE fee_amount = 0.0 OR fee_amount IS NULL");
                    log.info("Trade fee backfilling completed!");
                }

                // 4.8. DB의 현재 수수료율 값을 읽어서 AdminSettings 인메모리 홀더 동기화
                log.info("Caching market fee rates from database to AdminSettings...");
                try (Statement stmt = connection.createStatement();
                     ResultSet rs = stmt.executeQuery("SELECT symbol, fee_rate FROM market_fees")) {
                    while (rs.next()) {
                        String sym = rs.getString("symbol");
                        double rate = rs.getDouble("fee_rate");
                        if ("BTC-USD".equals(sym)) {
                            exchange.admin.config.AdminSettings.setBtcUsdFeeRate(rate);
                        } else if ("ADA-KRW".equals(sym)) {
                            exchange.admin.config.AdminSettings.setAdaKrwFeeRate(rate);
                        }
                    }
                    log.info("AdminSettings fee rate cache sync completed!");
                }
            } catch (Exception e) {
                log.error("Database schema validation/synchronization failed", e);
                return;
            }

            // 5. 기본 관리자 계정 자동 시딩 수행
            String adminEmail = "admin@javaf.net";
            try {
                if (userRepository.findByEmail(adminEmail).isEmpty()) {
                    log.info("Default admin user does not exist. Seeding default admin user ({})...", adminEmail);
                    userService.registerUser(adminEmail, "admin123", "ADMIN");
                    log.info("Default admin user seeded successfully!");
                } else {
                    log.info("Default admin user already exists.");
                }
            } catch (Exception e) {
                log.error("Default admin user seeding failed", e);
            }
        };
    }
}
