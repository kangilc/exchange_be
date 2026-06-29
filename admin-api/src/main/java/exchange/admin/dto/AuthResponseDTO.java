package exchange.admin.dto;

import exchange.admin.model.constant.UserGrade;
import lombok.Builder;
import lombok.Getter;

/**
 * 로그인 및 토큰 갱신 시 반환되는 응답 DTO.
 */
@Getter
@Builder
public class AuthResponseDTO {
    private String accessToken;
    private String refreshToken;
    private String email;
    private Long userId;
    private UserGrade grade;
    private boolean priorLoginExisted;
}
