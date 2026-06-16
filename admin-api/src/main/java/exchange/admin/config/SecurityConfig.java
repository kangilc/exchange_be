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

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    public SecurityConfig(JwtTokenProvider tokenProvider, UserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.userRepository = userRepository;
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() {
        return new JwtAuthenticationFilter(tokenProvider, userRepository);
    }

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
                .requestMatchers("/admin/users/me/**").permitAll() // 일반 사용자 본인 계정 정보(체결/원장 등) 조회 허용
                .requestMatchers("/admin/wallets/me").permitAll() // 일반 사용자 본인 지갑 조회 허용
                .requestMatchers("/admin/wallets/user/**").permitAll() // 일반 사용자 모의 지갑 조회 허용
                .requestMatchers("/admin/users/*/assets/adjust").permitAll() // 일반 사용자 모의 자산 조정 허용
                .requestMatchers("/admin/**").hasRole("ADMIN") // 그 외 관리자 경로는 ADMIN 권한 필수
                .anyRequest().authenticated()
            )
            // JWT 인증 필터를 UsernamePasswordAuthenticationFilter 앞에 추가
            .addFilterBefore(jwtAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

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
