package exchange.admin.dto;

import lombok.Data;
import java.time.LocalDateTime;

/**
 * 특정 유저의 체결 내역 조회를 위한 DTO 클래스.
 * MyBatis 쿼리 결과를 매핑함.
 */
@Data
public class UserTradeDto {
    // 체결 고유 식별자
    private Long tradeId;
    
    // 대상 자산/통화 심볼
    private String symbol;
    
    // 매수 주문 ID
    private Long buyOrderId;
    
    // 매도 주문 ID
    private Long sellOrderId;
    
    // 체결 가격
    private Long price;
    
    // 체결 수량
    private Long qty;
    
    // 체결 일시
    private LocalDateTime executedAt;
    
    // 매수/매도 포지션 (BUY 또는 SELL)
    private String side;
}
