package exchange.admin.config;

import exchange.admin.security.JwtAuthenticationFilter;
import exchange.admin.security.JwtTokenProvider;
import exchange.admin.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;

/**
 * Spring Security 및 웹 보안 설정을 통합 구성하는 클래스입니다.
 * 세션을 사용하지 않는 Stateless(REST API) 정책을 취하며, JWT 기반의 사용자 인증 메커니즘을 적용합니다.
 * CORS 정책 허용, Swagger UI 등의 공개 엔드포인트 라우팅 허용 및 BCrypt/SHA-256 호환 패스워드 인코더 등을 빈으로 등록합니다.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    /**
     * SecurityConfig 생성자. 의존 필터를 구성하기 위해 JWT 제공자와 유저 리포지토리를 주입받습니다.
     */
    public SecurityConfig(JwtTokenProvider tokenProvider, UserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    /**
     * HTTP 요청 인증 헤더의 JWT 유효성을 매번 검사하는 커스텀 필터 빈을 생성합니다.
     */
    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter(tokenProvider, userRepository);
    }

    /**
     * HTTP 보안 필터 체인을 구성합니다.
     * 엔드포인트별 인가 규칙(공개 경로 vs 인증 회원 전용 vs ADMIN 전용)을 세부 정의하고
     * CSRF 및 세션을 비활성화한 뒤 UsernamePasswordAuthenticationFilter 앞단에 JWT 필터를 설정합니다.
     *
     * @param http HttpSecurity 인스턴스
     * @return 빌드된 SecurityFilterChain
     * @throws Exception 보안 구성 예외
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll() // Swagger UI 및 OpenAPI 스펙 허용
                .requestMatchers("/admin/auth/**").permitAll() // 로그인/토큰갱신 공개
                .requestMatchers("/admin/stats/candles").permitAll() // 일반 사용자 차트용 캔들 조회 허용
                .requestMatchers("/admin/stats/markets").permitAll() // 일반 사용자 마켓 조회 허용
                .requestMatchers("/admin/stats/ticker", "/admin/stats/tickers").permitAll() // 일반 사용자 및 비인가 마켓 현재가 조회 허용
                .requestMatchers("/admin/users/me/**").authenticated() // 일반 사용자 본인 계정 정보(체결/원장 등) 조회 허용
                .requestMatchers("/admin/wallets/me").authenticated() // 일반 사용자 본인 지갑 조회 허용
                .requestMatchers("/admin/wallets/user/**").permitAll() // 일반 사용자 모의 지갑 조회 허용
                .requestMatchers("/admin/users/*/assets/adjust").permitAll() // 일반 사용자 모의 자산 조정 허용
                .requestMatchers("/admin/**").hasRole("ADMIN") // 그 외 관리자 경로는 ADMIN 권한 필수
                .anyRequest().authenticated()
            )
            // JWT 인증 필터를 UsernamePasswordAuthenticationFilter 앞에 추가
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * 인증을 처리하는 AuthenticationManager 빈을 반환합니다.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    /**
     * 모든 도메인(Origins) 및 주요 HTTP 메서드(GET, POST, PUT, DELETE 등)에 대한 CORS 정책을 설정합니다.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Collections.singletonList("*")); // 모든 origin 허용 (CORS)
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "Cache-Control"));
        configuration.setExposedHeaders(Collections.singletonList("Authorization"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * 패스워드 검증기 빈을 설정합니다.
     * 신규 비밀번호 생성 시에는 안전한 BCrypt 인코딩 방식을 기본 적용하고,
     * 기존 DB 내 시드 데이터(Mock 해시값) 및 과거 레거시 SHA-256 해시 비밀번호와 모두 호환되도록 커스텀 검증 방식을 지원합니다.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new PasswordEncoder() {
            private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

            @Override
            public String encode(CharSequence rawPassword) {
                // 신규 생성되는 패스워드는 무조건 안전한 BCrypt 인코딩 적용
                return bcrypt.encode(rawPassword);
            }

            @Override
            public boolean matches(CharSequence rawPassword, String encodedPassword) {
                if (encodedPassword == null) {
                    return false;
                }

                // 1. postgres-init.sql의 초기 시드 데이터 Mock 해시 매치
                if (encodedPassword.equals("$2a$10$eImiTXuWVxfM37uY4JANjO")) {
                    return rawPassword.toString().equals("password123");
                }

                // 2. 표준 BCrypt 해시 매치 (60글자 표준 길이 확인)
                if (encodedPassword.startsWith("$2a$") && encodedPassword.length() == 60) {
                    return bcrypt.matches(rawPassword, encodedPassword);
                }

                // 3. 레거시 SHA-256 해시 검증 호환
                return sha256Hex(rawPassword.toString()).equals(encodedPassword);
            }

            private String sha256Hex(String password) {
                try {
                    MessageDigest digest = MessageDigest.getInstance("SHA-256");
                    byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
                    StringBuilder hexString = new StringBuilder();
                    for (byte b : hash) {
                        String hex = Integer.toHexString(0xff & b);
                        if (hex.length() == 1) hexString.append('0');
                        hexString.append(hex);
                    }
                    return hexString.toString();
                } catch (Exception e) {
                    return password;
                }
            }
        };
    }
}
