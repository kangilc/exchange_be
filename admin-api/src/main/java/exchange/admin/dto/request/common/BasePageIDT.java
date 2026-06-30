package exchange.admin.dto.request.common;

import lombok.Data;

/**
 * 페이징 처리가 필요한 목록 조회 요청 시 사용되는 공통 최상위 부모 DTO.
 */
@Data
public class BasePageIDT {
    
    /**
     * 조회할 페이지 번호 (0-based)
     */
    private int page = 0;
    
    /**
     * 한 페이지당 조회할 개수
     */
    private int size = 20;
}
