package exchange.admin;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
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
    public CommandLineRunner initDatabase(DataSource dataSource) {
        return args -> {
            log.info("Running automatic database schema validation...");
            try (Connection conn = dataSource.getConnection()) {
                DatabaseMetaData metaData = conn.getMetaData();
                
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
                    try (Statement stmt = conn.createStatement()) {
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
                    try (Statement stmt = conn.createStatement()) {
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
                        try (Statement stmt = conn.createStatement()) {
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
                        try (Statement stmt = conn.createStatement()) {
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
                        try (Statement stmt = conn.createStatement()) {
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
                        try (Statement stmt = conn.createStatement()) {
                            stmt.execute("ALTER TABLE " + table + " ADD COLUMN updated_by VARCHAR(100)");
                            log.info("Column 'updated_by' added to '" + table + "' table successfully!");
                        }
                    }
                }

                // 4. 하드코딩된 시드 데이터로 인해 어긋난 users_user_id_seq 시퀀스를 테이블 최댓값에 맞게 자동 동기화 처리함 (중복 키 오류 방지용)
                log.info("Synchronizing users_user_id_seq sequence...");
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("SELECT setval('users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM users), 0) + 1, false)");
                    log.info("users_user_id_seq sequence synchronized successfully!");
                }
            } catch (Exception e) {
                log.error("Database schema validation failed", e);
            }
        };
    }

    @Bean
    public CommandLineRunner seedAdminUser(exchange.admin.service.UserService userService, exchange.admin.repository.UserRepository userRepository) {
        return args -> {
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
