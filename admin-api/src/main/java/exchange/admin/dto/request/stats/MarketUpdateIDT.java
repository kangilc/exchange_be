package exchange.admin.dto.request.stats;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * 마켓 정보 수정 요청용 DTO 클래스.
 */
@Getter
@Setter
public class MarketUpdateIDT {
    private Long listingPrice;
    private BigDecimal feeRate;
    private Integer priceDecimals;
    private BigDecimal minAmt;
    private String status;
}
