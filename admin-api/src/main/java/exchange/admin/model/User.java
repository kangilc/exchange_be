package exchange.admin.model;

import exchange.admin.model.constant.UserGrade;
import exchange.admin.model.constant.UserRole;
import jakarta.persistence.*;

/**
 * 거래소 회원의 계정 정보를 담고 있는 JPA 엔티티 클래스입니다.
 * 이메일, 패스워드 해시값, 회원 상태(ACTIVE, INACTIVE 등), 등급(ADMIN, STANDARD 등), 그리고 중복 로그인 검증 및 토큰 회전(RTR)을 위한 Refresh Token을 보관합니다.
 */
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "email", unique = true, nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "status")
    private String status = "ACTIVE";

    // 회원 거래 등급 (Enum화 및 JPA 문자열 바인딩 적용)
    @Enumerated(EnumType.STRING)
    @Column(name = "grade")
    private UserGrade grade = UserGrade.STANDARD;

    @Column(name = "refresh_token")
    private String refreshToken;

    // 회원 역할 권한 (Enum화 및 JPA 문자열 바인딩 적용)
    @Enumerated(EnumType.STRING)
    @Column(name = "role")
    private UserRole role = UserRole.USER;

    public User() {
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UserGrade getGrade() {
        return grade;
    }

    public void setGrade(UserGrade grade) {
        this.grade = grade;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }
}
