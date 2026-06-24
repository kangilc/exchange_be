package exchange.admin.config;

import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * JPA Auditing 기능(BaseEntity의 @CreatedBy, @LastModifiedBy)과 연동하여
 * 영속성 엔티티가 생성되거나 수정될 때 이를 수행한 주체의 식별자를 자동으로 채워주는 구현체입니다.
 * 1. AuditorContextHolder에 저장된 백그라운드 시스템 명칭이 있을 경우 이를 우선 사용합니다.
 * 2. 그 외에는 Spring Security SecurityContextHolder의 인증 정보(로그인 사용자 이메일 등)를 추출하여 사용하며,
 * 3. 둘 다 존재하지 않는 경우 기본 식별자인 "SYSTEM"을 부여합니다.
 */
@Component
public class ExchangeAuditorAware implements AuditorAware<String> {

    @Override
    public Optional<String> getCurrentAuditor() {
        // 1. ThreadLocal에 명시적으로 지정된 시스템 등록자가 있는지 확인
        String systemAuditor = AuditorContextHolder.getSystemAuditor();
        if (systemAuditor != null) {
            return Optional.of(systemAuditor);
        }

        // 2. Spring Security 인증 객체(로그인 사용자) 확인
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return Optional.of("SYSTEM"); // 로그인 정보도 없고 시스템 지정도 없는 경우 기본값
        }

        return Optional.of(authentication.getName()); // 로그인 유저 ID(이메일 등) 반환
    }
}
