package exchange.admin;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

import org.springframework.boot.test.mock.mockito.MockBean;
import exchange.admin.repository.es.UserSearchRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class BaseIntegrationTest {

    @MockBean
    protected UserSearchRepository userSearchRepository;

    // 테스트 클래스 전체에서 공유할 싱글톤 PostgreSQL 컨테이너 정의 (JVM 수명 주기 동안 단 1회만 구동)
    static final PostgreSQLContainer<?> postgres;

    static {
        postgres = new PostgreSQLContainer<>("postgres:15-alpine")
                .withDatabaseName("exchange_test")
                .withUsername("testuser")
                .withPassword("testpass");
        postgres.start(); // 최초 클래스 로드 시 수동 즉시 시작
    }

    // 스프링 부트 애플리케이션 콘텍스트 로드 시 공유 컨테이너 정보 동적 주입
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        // Flyway 스키마 마이그레이션 대상 데이터베이스 지정
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
    }
}
