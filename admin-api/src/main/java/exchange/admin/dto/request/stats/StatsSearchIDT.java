package exchange.admin.dto.request.stats;

import exchange.admin.dto.request.common.DateRangePageIDT;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 통계 검색 파라미터를 담는 IDT 객체.
 * 기간 검색 공통 파라미터(DateRangePageIDT)를 상속받아 사용합니다.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class StatsSearchIDT extends DateRangePageIDT {

    /**
     * 시간 해상도 (daily, 1h, 5m 등)
     */
    private String resolution = "daily";
    
    /**
     * 특정 종목(심볼) 필터링이 필요할 경우 사용.
     */
    private String symbol;
}
