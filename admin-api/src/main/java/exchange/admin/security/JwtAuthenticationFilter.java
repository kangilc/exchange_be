package exchange.admin.security;

import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

/**
 * HTTP 요청당 한 번만 호출(OncePerRequestFilter 상속)되며, 요청 헤더의 JWT 토큰을 추출 및 검증하는 보안 필터입니다.
 * 중복 로그인 차단이 활성화되어 있을 경우, 토큰 안의 refreshToken 클레임값과 DB 회원 데이터의 리프레시 토큰이 일치하는지 추가 검증합니다.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    /**
     * JwtAuthenticationFilter 생성자.
     * 
     * @param tokenProvider JWT 검증 및 클레임 분석을 위한 JwtTokenProvider
     * @param userRepository 중복 로그인 확인을 위한 UserRepository
     */
    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider, UserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (jwt != null && tokenProvider.validateToken(jwt)) {
                String email = tokenProvider.getEmailFromToken(jwt);
                String role = tokenProvider.getRoleFromToken(jwt);
                String refreshToken = tokenProvider.getRefreshTokenFromToken(jwt);

                if (email != null && role != null && refreshToken != null) {
                    boolean authenticated = true;

                    // 중복 로그인 차단 기능이 ON인 경우에만 DB의 최신 토큰과 대조 검증 수행
                    if (exchange.admin.config.AdminSettings.isDuplicateLoginBlockEnabled()) {
                        Optional<User> userOpt = userRepository.findByEmail(email);
                        if (userOpt.isEmpty() || !refreshToken.equals(userOpt.get().getRefreshToken())) {
                            authenticated = false;
                        }
                    }

                    if (authenticated) {
                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                email, null, Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                        );
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        } catch (Exception ex) {
            logger.error("Could not set user authentication in security context", ex);
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
