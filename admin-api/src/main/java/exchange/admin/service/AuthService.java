package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.dto.response.AuthResponseODT;
import exchange.admin.exception.AuthException;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import exchange.admin.security.JwtTokenProvider;
import exchange.admin.model.constant.UserGrade;
import exchange.admin.model.constant.UserRole;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 인증 및 토큰 관련 비즈니스 로직을 전담하는 서비스.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtTokenProvider tokenProvider;
    private final PasswordEncoder passwordEncoder;

    /**
     * AuthService 생성자 주입.
     */
    public AuthService(UserRepository userRepository,
            JwtTokenProvider tokenProvider,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.tokenProvider = tokenProvider;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 신규 사용자 회원가입 신청 처리.
     * 상태는 'PENDING'으로 고정되며 관리자 승인 전까지 로그인 불가.
     * 
     * @param email    가입할 이메일
     * @param password 비밀번호
     * @return 가입 완료된 User 엔티티
     */
    @Transactional
    public User signup(String email, String password) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("이미 가입된 이메일 주소입니다.");
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setGrade(UserGrade.STANDARD);
        user.setRole(UserRole.USER);
        user.setStatus("PENDING"); // 어드민 승인 대기 상태
        return userRepository.save(user);
    }

    /**
     * 로그인 검증 및 토큰 발급 로직.
     */
    public AuthResponseODT login(String email, String password) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            throw new AuthException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        User user = userOpt.get();

        // 비밀번호 검증
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new AuthException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 상태(Status) 검증: ACTIVE 상태만 허용
        if (!"ACTIVE".equals(user.getStatus())) {
            if ("PENDING".equals(user.getStatus())) {
                throw new AuthException("승인 대기 중인 계정입니다. 관리자의 승인이 필요합니다.");
            } else if ("SUSPENDED".equals(user.getStatus())) {
                throw new AuthException("거래정지(SUSPENDED) 상태인 계정입니다. 관리자에게 문의해 주세요.");
            } else {
                throw new AuthException("비활성화된 계정입니다. 관리자의 확인이 필요합니다.");
            }
        }

        // 토큰 발급
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        // JWT 토큰에 관리자 권한(Role)을 명시적으로 주입함
        String accessToken = tokenProvider.generateAccessToken(user.getUserId(), user.getEmail(), user.getRole().name(),
                refreshToken);

        // 중복 로그인 확인
        boolean priorLoginExisted = AdminSettings.isDuplicateLoginBlockEnabled()
                && (user.getRefreshToken() != null && !user.getRefreshToken().trim().isEmpty());

        // 토큰 저장 (로그인 성공에 따른 신규 리프레시 토큰 정보 영속화 처리함)
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        return AuthResponseODT.builder()
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
    public AuthResponseODT refresh(String refreshToken) {
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

        // 상태(Status) 검증: ACTIVE 상태만 허용
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new AuthException("활성화되지 않은 계정입니다.");
        }

        // 2. DB 기록과 대조
        if (user.getRefreshToken() == null || !user.getRefreshToken().equals(refreshToken)) {
            throw new AuthException("만료되었거나 이미 교체된 Refresh Token입니다. 강제 로그아웃됩니다.");
        }

        // 3. 토큰 회전(RTR) 및 재발급 (권한 주입 포함)
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        String newAccessToken = tokenProvider.generateAccessToken(user.getUserId(), user.getEmail(),
                user.getRole().name(), newRefreshToken);

        // 토큰 저장 (토큰 갱신에 따른 신규 리프레시 토큰 정보 영속화 처리함)
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);

        return AuthResponseODT.builder()
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
                // 토큰 저장 (로그아웃 요청에 따른 리프레시 토큰 정보 파기 처리함)
                user.setRefreshToken(null);
                userRepository.save(user);
            }
        }
    }
}
