package exchange.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 회원 검색 결과를 표현하는 Output Data Transfer DTO.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSearchODT {
    private Long userId;
    private String email;
    private String status;
    private String grade;
    private String role;
    private Long createdAt;
}
