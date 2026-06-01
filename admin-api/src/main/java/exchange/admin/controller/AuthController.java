package exchange.admin.controller;

import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import exchange.admin.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

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

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String password = request.get("password");

        if (email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "이메일과 비밀번호는 필수 입력 항목입니다."));
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
        }

        User user = userOpt.get();

        // 관리자 전용 로그인 검증 (어드민 등급 확인)
        if (!"ADMIN".equalsIgnoreCase(user.getGrade())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "관리자 권한이 없습니다."));
        }

        // 비밀번호 대조
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "이메일 또는 비밀번호가 올바르지 않습니다."));
        }

        // 토큰 쌍 생성
        String accessToken = tokenProvider.generateAccessToken(user.getEmail(), user.getGrade());
        String refreshToken = tokenProvider.generateRefreshToken(user.getEmail());

        // Refresh Token DB 저장 (RTR 준비)
        user.setRefreshToken(refreshToken);
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("accessToken", accessToken);
        response.put("refreshToken", refreshToken);
        response.put("email", user.getEmail());
        response.put("grade", user.getGrade());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        if (refreshToken == null || refreshToken.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Refresh Token은 필수입니다."));
        }

        // 1. 토큰 자체 유효성 검증
        if (!tokenProvider.validateToken(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "만료되었거나 유효하지 않은 Refresh Token입니다."));
        }

        String email = tokenProvider.getEmailFromToken(refreshToken);

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "사용자를 찾을 수 없습니다."));
        }

        User user = userOpt.get();

        // 2. DB에 기록된 Refresh Token 값과 전송된 토큰 값 대조 (Replay Attack 방어)
        if (user.getRefreshToken() == null || !user.getRefreshToken().equals(refreshToken)) {
            // 이미 사용되었거나 비정상적인 접근 감지 시 자격 증명 전체 초기화 (보안 강화)
            user.setRefreshToken(null);
            userRepository.save(user);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "비정상적이거나 이미 재사용된 Refresh Token 감지. 강제 로그아웃됩니다."));
        }

        // 3. 토큰 회전(RTR) 적용: 새 Access Token 및 새 Refresh Token 발급
        String newAccessToken = tokenProvider.generateAccessToken(user.getEmail(), user.getGrade());
        String newRefreshToken = tokenProvider.generateRefreshToken(user.getEmail());

        // 새 Refresh Token 데이터베이스 업데이트
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);

        Map<String, String> response = new HashMap<>();
        response.put("accessToken", newAccessToken);
        response.put("refreshToken", newRefreshToken);

        return ResponseEntity.ok(response);
    }

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
