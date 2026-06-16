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

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

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
