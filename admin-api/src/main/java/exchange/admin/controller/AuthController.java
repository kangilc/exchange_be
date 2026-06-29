package exchange.admin.controller;

import exchange.admin.dto.LoginRequestIDT;
import exchange.admin.dto.AuthResponseDTO;
import exchange.admin.service.AuthService;
import jakarta.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 인증 처리 컨트롤러.
 * 로그인, 토큰 갱신(RTR), 로그아웃 기능 제공.
 */
@RestController
@RequestMapping("/admin/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private AuthService authService;

    /**
     * 로그인 처리 및 JWT 발급.
     * 중복 로그인 차단 활성화 시 기존 세션 여부 포함.
     * 
     * @param request 로그인 DTO
     * @return 인증 토큰 및 사용자 정보
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponseDTO> login(@Valid @RequestBody LoginRequestIDT request) {
        AuthResponseDTO response = authService.login(request.getEmail(), request.getPassword());
        return ResponseEntity.ok(response);
    }

    /**
     * 토큰 재발급(RTR).
     * 기존 Refresh Token 무효화 및 새 토큰 발급.
     * 
     * @param request Refresh Token
     * @return 신규 발급 토큰
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponseDTO> refresh(@RequestBody Map<String, String> request) {
        String refreshToken = request.get("refreshToken");
        AuthResponseDTO response = authService.refresh(refreshToken);
        return ResponseEntity.ok(response);
    }

    /**
     * 로그아웃 처리.
     * DB의 Refresh Token 무효화.
     * 
     * @param request 대상 이메일
     * @return 처리 결과
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        authService.logout(email);
        return ResponseEntity.ok(Map.of("message", "성공적으로 로그아웃되었습니다."));
    }
}
