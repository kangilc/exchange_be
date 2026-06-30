package exchange.admin.dto.request.common;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * 날짜 범위(시작일, 종료일)와 페이징 처리가 함께 필요한 목록 조회 시 사용되는 공통 부모 DTO.
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class DateRangePageIDT extends BasePageIDT {
    
    /**
     * 조회 시작일.
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime startDate;
    
    /**
     * 조회 종료일.
     */
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
    private LocalDateTime endDate;
    
    /**
     * 날짜 파라미터가 누락되었을 경우를 대비하여 기본 기간(최근 30일)을 계산해 반환하는 유틸리티 메서드.
     * 
     * @return 널이 아닌 유효한 조회 종료일
     */
    public LocalDateTime getFinalEndDate() {
        return this.endDate != null ? this.endDate : LocalDateTime.now();
    }
    
    /**
     * 날짜 파라미터가 누락되었을 경우를 대비하여 기본 기간(최근 30일)을 계산해 반환하는 유틸리티 메서드.
     * 
     * @return 널이 아닌 유효한 조회 시작일
     */
    public LocalDateTime getFinalStartDate() {
        return this.startDate != null ? this.startDate : getFinalEndDate().minusDays(30);
    }
}
