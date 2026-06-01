package exchange.admin;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;

@SpringBootApplication
public class AdminApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminApiApplication.class, args);
    }

    @Bean
    public CommandLineRunner initDatabase(DataSource dataSource) {
        return args -> {
            System.out.println("Running automatic database schema validation...");
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
                    System.out.println("Column 'grade' does not exist in 'users' table. Running ALTER TABLE statement...");
                    try (Statement stmt = conn.createStatement()) {
                        stmt.execute("ALTER TABLE users ADD COLUMN grade VARCHAR(20) DEFAULT 'STANDARD'");
                        System.out.println("Column 'grade' added to 'users' table successfully!");
                    }
                } else {
                    System.out.println("Column 'grade' already exists in 'users' table.");
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
                    System.out.println("Column 'refresh_token' does not exist in 'users' table. Running ALTER TABLE statement...");
                    try (Statement stmt = conn.createStatement()) {
                        stmt.execute("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(512)");
                        System.out.println("Column 'refresh_token' added to 'users' table successfully!");
                    }
                } else {
                    System.out.println("Column 'refresh_token' already exists in 'users' table.");
                }
            } catch (Exception e) {
                System.err.println("Database schema validation failed: " + e.getMessage());
                e.printStackTrace();
            }
        };
    }

    @Bean
    public CommandLineRunner seedAdminUser(exchange.admin.service.UserService userService, exchange.admin.repository.UserRepository userRepository) {
        return args -> {
            String adminEmail = "admin@javaf.net";
            try {
                if (userRepository.findByEmail(adminEmail).isEmpty()) {
                    System.out.println("Default admin user does not exist. Seeding default admin user (" + adminEmail + ")...");
                    userService.registerUser(adminEmail, "admin123", "ADMIN");
                    System.out.println("Default admin user seeded successfully!");
                } else {
                    System.out.println("Default admin user already exists.");
                }
            } catch (Exception e) {
                System.err.println("Default admin user seeding failed: " + e.getMessage());
                e.printStackTrace();
            }
        };
    }
}
