package exchange.admin.dto.request.user;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * 신규 회원 가입 요청 시 사용되는 IDT(Input Data Transfer) 객체.
 */
@Data
public class UserRegisterIDT {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Schema(description = "이메일", example = "test_user_001@exchange.net")
    private String email;

    @NotBlank(message = "Password is required")
    @Schema(description = "password", example = "password123!")
    private String password;

    // 회원 거래 등급 (STANDARD, VIP 등)
    @Schema(description = "grade", example = "ADMIN")
    private String grade;

    // 회원 시스템 역할 권한 (ADMIN, USER 등)
    @Schema(description = "role", example = "USER")
    private String role;
}
