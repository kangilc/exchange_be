package exchange.admin.controller;

import exchange.admin.config.AdminSettings;
import exchange.admin.dto.LoginRequestIDT;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import exchange.admin.security.JwtTokenProvider;
import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 어드민 및 회원 인증 처리를 담당하는 컨트롤러입니다.
 * 이메일/비밀번호 기반 로그인, Refresh Token을 활용한 토큰 갱신(RTR 적용), 로그아웃 기능을 제공합니다.
 */
@RestController
@RequestMapping("/admin/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * 이메일과 비밀번호를 검증하여 로그인 처리를 수행하고 JWT 토큰 쌍을 발급합니다.
     * 중복 로그인 제한 설정이 활성화된 경우, 기존 세션 존재 여부를 응답에 포함합니다.
     * 
     * @param request 이메일과 패스워드가 담긴 DTO
     * @return 로그인 성공 시 accessToken, refreshToken 및 회원 정보 반환
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequestIDT request) {
        String email = request.getEmail();
        String password = request.getPassword();

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
        }

        User user = userOpt.get();

        // 비밀번호 대조
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
        }

        // 토큰 쌍 생성 (user.getGrade() Enum의 name() 스트링 전달)
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        String accessToken = tokenProvider.generateAccessToken(user.getUserId(), user.getEmail(), user.getGrade().name(), refreshToken);

        // 중복 로그인 여부 판별 (차단 설정이 켜져 있고 이전 리프레시 토큰이 DB에 있으면 이미 로그인된 상태임)
        boolean priorLoginExisted = AdminSettings.isDuplicateLoginBlockEnabled()
                && (user.getRefreshToken() != null && !user.getRefreshToken().trim().isEmpty());

        // Refresh Token DB 저장 (RTR 준비)
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("accessToken", accessToken);
        response.put("refreshToken", refreshToken);
        response.put("email", user.getEmail());
        response.put("userId", user.getUserId());
        response.put("grade", user.getGrade());
        response.put("priorLoginExisted", priorLoginExisted);

        return ResponseEntity.ok(response);
    }

    /**
     * Refresh Token을 확인하여 새로운 Access Token 및 Refresh Token 쌍을 재발급합니다.
     * RTR (Refresh Token Rotation) 정책이 적용되어 발급받은 Refresh Token은 1회성으로 소비되고 무효화됩니다.
     * 
     * @param request refreshToken 값을 담은 맵
     * @return 신규 발급된 JWT 토큰 쌍
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        if (refreshToken == null || refreshToken.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Refresh Token은 필수입니다."));
        }

        // 1. 토큰 자체 유효성 검증
        if (!tokenProvider.validateToken(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "만료되었거나 유효하지 않은 Refresh Token입니다."));
        }

        String email = tokenProvider.getEmailFromToken(refreshToken);

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }

        User user = userOpt.get();

        // 2. DB에 기록된 Refresh Token 값과 전송된 토큰 값 대조
        if (user.getRefreshToken() == null || !user.getRefreshToken().equals(refreshToken)) {
            // 다른 세션에서 로그인하여 토큰이 갱신된 경우이므로 DB의 활성화된 세션 토큰을 무효화하지 않고
            // 요청한 예전 토큰에 대해서만 인증 오류를 반환합니다.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "만료되었거나 이미 교체된 Refresh Token입니다. 강제 로그아웃됩니다."));
        }

        // 3. 토큰 회전(RTR) 적용: 새 Access Token 및 새 Refresh Token 발급 (user.getGrade() Enum의 name() 스트링 전달)
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getEmail());
        String newAccessToken = tokenProvider.generateAccessToken(user.getUserId(), user.getEmail(), user.getGrade().name(), newRefreshToken);

        // 새 Refresh Token 데이터베이스 업데이트
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);

        Map<String, String> response = new HashMap<>();
        response.put("accessToken", newAccessToken);
        response.put("refreshToken", newRefreshToken);

        return ResponseEntity.ok(response);
    }

    /**
     * 회원의 로그아웃을 처리하며, 데이터베이스에 등록되어 있던 Refresh Token 값을 무효화(null) 처리합니다.
     * 
     * @param request 로그아웃 대상 이메일(email)이 기입된 맵
     * @return 로그아웃 성공 메시지
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody Map<String, String> request) {
        String email = request.get("email");

        if (email != null) {
            Optional<User> userOpt = userRepository.findByEmail(email);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                user.setRefreshToken(null); // 토큰 제거로 세션 완전 차단
                userRepository.save(user);
            }
        }

        return ResponseEntity.ok(Map.of("message", "성공적으로 로그아웃되었습니다."));
    }
}
