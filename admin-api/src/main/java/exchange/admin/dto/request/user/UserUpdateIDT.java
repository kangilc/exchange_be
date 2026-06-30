package exchange.admin.dto.request.user;

import lombok.Data;
import jakarta.validation.constraints.Email;

/**
 * 회원 정보 수정 요청 시 사용되는 IDT 객체.
 */
@Data
public class UserUpdateIDT {

    @Email(message = "Invalid email format")
    private String email;

    private String status;

    private String grade;
}
