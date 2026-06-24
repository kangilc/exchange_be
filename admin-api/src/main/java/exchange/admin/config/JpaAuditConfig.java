package exchange.admin.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * JPA Auditing 기능을 활성화하는 Spring 설정 클래스입니다.
 * 엔티티 객체의 생성일시, 수정일시, 생성자, 수정자를 자동으로 기록하도록 지원하며,
 * 식별자 추출 빈으로 "exchangeAuditorAware"를 지정하여 연동합니다.
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "exchangeAuditorAware")
public class JpaAuditConfig {
}
