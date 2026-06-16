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
                // 1. 하드코딩된 시드 데이터로 인해 어긋난 users_user_id_seq 시퀀스를 테이블 최댓값에 맞게 자동 동기화 처리함 (중복 키 오류 방지용)
                log.info("Synchronizing users_user_id_seq sequence...");
                try (Statement stmt = connection.createStatement()) {
                    stmt.execute("SELECT setval('users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM users), 0) + 1, false)");
                    log.info("users_user_id_seq sequence synchronized successfully!");
                }

                // 2. DB의 현재 수수료율 값을 읽어서 AdminSettings 인메모리 홀더 동기화
                log.info("Caching market fee rates from database to AdminSettings...");
                try (Statement stmt = connection.createStatement();
                     ResultSet rs = stmt.executeQuery("SELECT symbol, fee_rate FROM markets")) {
                    while (rs.next()) {
                        String sym = rs.getString("symbol");
                        double rate = rs.getDouble("fee_rate");
                        exchange.admin.config.AdminSettings.setFeeRate(sym, rate);
                    }
                    log.info("AdminSettings fee rate cache sync completed!");
                }
            } catch (Exception e) {
                log.error("Database initialization task failed", e);
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
