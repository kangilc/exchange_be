package exchange.admin.security;

import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Spring Security의 UserDetailsService를 구현한 커스텀 서비스 클래스입니다.
 * DB로부터 사용자 정보를 이메일 기준으로 조회한 뒤 Spring Security가 요구하는 UserDetails 객체로 변환하여 제공합니다.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    /**
     * 입력받은 이메일을 식별자로 사용하여 회원 정보를 조회하고 권한(GRADE)정보를 스프링 시큐리티 권한 형태로 변환 매핑합니다.
     * 
     * @param email 사용자 식별 이메일
     * @return UserDetails 객체 (스프링 시큐리티 규격)
     * @throws UsernameNotFoundException 해당 이메일을 가진 회원이 존재하지 않는 경우 예외 발생
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        // 예: GRADE가 'ADMIN'이면 ROLE_ADMIN 권한 매핑
        String role = "ROLE_" + user.getGrade().toUpperCase();

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                Collections.singletonList(new SimpleGrantedAuthority(role))
        );
    }
}
