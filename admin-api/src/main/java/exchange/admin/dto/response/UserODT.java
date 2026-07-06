package exchange.admin.dto.response;

import exchange.admin.model.User;
import exchange.admin.model.constant.UserGrade;
import exchange.admin.model.constant.UserRole;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 회원 정보 응답용 DTO 클래스.
 */
@Getter
@Setter
public class UserODT {
    private Long userId;
    private String email;
    private String status;
    private UserGrade grade;
    private UserRole role;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UserODT() {
    }

    /**
     * 엔티티 객체로부터 DTO 객체를 생성함.
     *
     * @param user 회원 엔티티
     */
    public UserODT(User user) {
        if (user != null) {
            this.userId = user.getUserId();
            this.email = user.getEmail();
            this.status = user.getStatus();
            this.grade = user.getGrade();
            this.role = user.getRole();
            this.createdAt = user.getCreatedAt();
            this.updatedAt = user.getUpdatedAt();
        }
    }
}
