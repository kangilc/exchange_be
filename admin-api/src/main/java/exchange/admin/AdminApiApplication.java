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

                // 3. 하드코딩된 시드 데이터로 인해 어긋난 users_user_id_seq 시퀀스를 테이블 최댓값에 맞게 자동 동기화 처리함 (중복 키 오류 방지용)
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
