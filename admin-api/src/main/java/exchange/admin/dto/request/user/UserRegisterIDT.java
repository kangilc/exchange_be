package exchange.admin.dto.request.user;

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
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

    private String grade;
}
