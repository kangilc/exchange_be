package exchange.admin.dto.response;

import exchange.admin.model.Market;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 마켓 정보 응답용 DTO 클래스.
 */
@Getter
@Setter
public class MarketODT {
    private String symbol;
    private String baseCurrency;
    private String quoteCurrency;
    private BigDecimal feeRate;
    private Integer priceDecimals;
    private BigDecimal minAmt;
    private String status;
    private Long listingPrice;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    // 호가 단위 정책 그룹 ID
    private String tickSizeRuleId;
    // 가격대별 상세 호가 단위 설정 목록
    private java.util.List<TickSizeLevelODT> tickSizeLevels;

    public MarketODT() {
    }

    /**
     * 엔티티 객체로부터 DTO 객체를 생성함.
     *
     * @param market 마켓 엔티티
     */
    public MarketODT(Market market) {
        if (market != null) {
            this.symbol = market.getSymbol();
            this.baseCurrency = market.getBaseCurrency();
            this.quoteCurrency = market.getQuoteCurrency();
            this.feeRate = market.getFeeRate();
            this.priceDecimals = market.getPriceDecimals();
            this.minAmt = market.getMinAmt();
            this.status = market.getStatus();
            this.listingPrice = market.getListingPrice();
            this.createdAt = market.getCreatedAt();
            this.updatedAt = market.getUpdatedAt();
            this.tickSizeRuleId = market.getTickSizeRuleId();
            if (market.getTickSizeRule() != null && market.getTickSizeRule().getLevels() != null) {
                this.tickSizeLevels = market.getTickSizeRule().getLevels().stream()
                        .map(TickSizeLevelODT::new)
                        .collect(java.util.stream.Collectors.toList());
            }
        }
    }

    /**
     * 📊 호가 단위 세부 가격 레벨 응답 DTO
     */
    @Getter
    @Setter
    public static class TickSizeLevelODT {
        // 적용 경계 가격
        private BigDecimal priceAbove;
        // 호가 틱 크기
        private BigDecimal tickSize;

        public TickSizeLevelODT() {}

        public TickSizeLevelODT(exchange.admin.model.TickSizeLevel level) {
            if (level != null) {
                this.priceAbove = level.getPriceAbove();
                this.tickSize = level.getTickSize();
            }
        }
    }
}
