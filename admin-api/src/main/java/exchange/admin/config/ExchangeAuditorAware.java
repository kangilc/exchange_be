package exchange.admin.config;

import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

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
