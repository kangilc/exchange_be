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
                
                // Check if 'grade' column exists in 'users' table
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
            } catch (Exception e) {
                System.err.println("Database schema validation failed: " + e.getMessage());
                e.printStackTrace();
            }
        };
    }
}
