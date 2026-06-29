package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.dto.AuthResponseDTO;
import exchange.admin.exception.AuthException;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import exchange.admin.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * 인증 및 토큰 관련 비즈니스 로직을 전담하는 서비스.
 */
@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * 로그인 검증 및 토큰 발급 로직.
     */
    public AuthResponseDTO login(String email, String password) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            throw new AuthException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = userOpt.get();

        // 비밀번호 검증
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new AuthException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 토큰 발급
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        // JWT 토큰에 관리자 권한(Role)을 명시적으로 주입함
        String accessToken = tokenProvider.generateAccessToken(user.getUserId(), user.getEmail(), user.getRole().name(), refreshToken);

        // 중복 로그인 확인
        boolean priorLoginExisted = AdminSettings.isDuplicateLoginBlockEnabled()
                && (user.getRefreshToken() != null && !user.getRefreshToken().trim().isEmpty());

        // 토큰 저장
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        return AuthResponseDTO.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .email(user.getEmail())
                .userId(user.getUserId())
                .grade(user.getGrade())
                .priorLoginExisted(priorLoginExisted)
                .build();
    }

    /**
     * Refresh Token 갱신(RTR) 로직.
     */
    public AuthResponseDTO refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.trim().isEmpty()) {
            throw new AuthException("Refresh Token은 필수입니다.");
        }

        // 1. 토큰 자체 유효성 검증
        if (!tokenProvider.validateToken(refreshToken)) {
            throw new AuthException("만료되었거나 유효하지 않은 Refresh Token입니다.");
        }

        String email = tokenProvider.getEmailFromToken(refreshToken);

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            throw new AuthException("사용자를 찾을 수 없습니다.");
        }

        User user = userOpt.get();

        // 2. DB 기록과 대조
        if (user.getRefreshToken() == null || !user.getRefreshToken().equals(refreshToken)) {
            throw new AuthException("만료되었거나 이미 교체된 Refresh Token입니다. 강제 로그아웃됩니다.");
        }

        // 3. 토큰 회전(RTR) 및 재발급 (권한 주입 포함)
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        String newAccessToken = tokenProvider.generateAccessToken(user.getUserId(), user.getEmail(), user.getRole().name(), newRefreshToken);

        // 토큰 저장
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);

        return AuthResponseDTO.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .email(user.getEmail())
                .userId(user.getUserId())
                .grade(user.getGrade())
                .priorLoginExisted(false)
                .build();
    }

    /**
     * 로그아웃(토큰 무효화) 로직.
     */
    public void logout(String email) {
        if (email != null) {
            Optional<User> userOpt = userRepository.findByEmail(email);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                user.setRefreshToken(null); // 토큰 제거
                userRepository.save(user);
            }
        }
    }
}
