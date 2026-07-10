package exchange.admin.dto;

import exchange.admin.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 카프카를 통해 전송할 유저 색인 동기화 데이터 전송 객체 (DTO).
 * JPA 엔티티 직접 직렬화 시의 순환 참조 및 LazyLoading 문제를 방지하기 위해 생성함.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSyncMessage {

    // 유저 고유 식별 번호 (DB의 PK)
    private Long userId;

    // 로그인 이메일 주소 (자동완성 검색 대상)
    private String email;

    // 가입 상태 (PENDING, ACTIVE, BLOCKED 등)
    private String status;

    // 유저 등급
    private String grade;

    // 회원 권한 (ROLE_USER, ROLE_ADMIN 등)
    private String role;

    // 가입 일시 (Epoch Millisecond 형식으로 변환하여 전달)
    private Long createdAt;

    // true → Elasticsearch 인덱스에서 문서 삭제, false → 저장/수정
    private boolean isDelete;

    /**
     * JPA User 엔티티를 카프카 메시지 DTO로 변환하는 정적 팩토리 메서드.
     *
     * @param user     JPA User 엔티티
     * @param isDelete 삭제 여부 플래그
     * @return UserSyncMessage DTO 객체
     */
    public static UserSyncMessage from(User user, boolean isDelete) {
        if (user == null) {
            return null;
        }
        return UserSyncMessage.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .status(user.getStatus())
                .grade(user.getGrade() != null ? user.getGrade().name() : null)
                .role(user.getRole() != null ? user.getRole().name() : null)
                .createdAt(user.getCreatedAt() != null ? user.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() : null)
                .isDelete(isDelete)
                .build();
    }
}
