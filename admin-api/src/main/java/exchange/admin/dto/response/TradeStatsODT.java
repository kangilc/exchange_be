package exchange.admin.dto.response;

import lombok.Data;

/**
 * 체결 내역 통계 조회를 위한 DTO 클래스.
 * MyBatis 쿼리 결과를 매핑함.
 */
@Data
public class TradeStatsODT {
    // 통계 시간대 (버킷)
    private String bucket;
    
    // 체결 건수
    private Long tradeCount;
    
    // 체결 총 수량
    private Long totalQty;
    
    // 평균 체결 가격
    private Double avgPrice;
    
    // 총 거래 대금 (볼륨)
    private Double totalVolume;
}
