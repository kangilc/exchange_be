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

/**
 * 어드민 API 애플리케이션의 메인 진입점 클래스.
 * Spring Boot 애플리케이션을 구동하며, 스케줄링 기능을 활성화하고,
 * 로컬/개발 환경에서의 초기 데이터베이스 유효성 검사 및 시딩(Seed) 작업을 처리합니다.
 */
@Slf4j
@SpringBootApplication
@EnableScheduling
public class AdminApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminApiApplication.class, args);
    }

    /**
     * 로컬(local) 또는 개발(dev) 프로파일 활성화 시, 데이터베이스 스키마 검증 및 기본 데이터를 시딩하는 빈입니다.
     * 데이터베이스 준비 상태를 최대 15회 재시도하며 확인한 뒤, 시퀀스 동기화, 수수료 설정 캐싱 및 기본 어드민 계정 자동 등록을 수행합니다.
     *
     * @param dataSource 데이터베이스 연결 정보를 가진 DataSource
     * @param userService 어드민 가입 처리를 위한 UserService
     * @param userRepository 어드민 중복 확인을 위한 UserRepository
     * @return 애플리케이션 구동 시 실행될 CommandLineRunner
     */
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
