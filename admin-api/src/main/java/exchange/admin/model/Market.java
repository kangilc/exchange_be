package exchange.admin.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "markets")
public class Market extends BaseEntity {

    @Id
    @Column(name = "symbol", length = 20)
    private String symbol;

    @Column(name = "base_currency", nullable = false, length = 10)
    private String baseCurrency;

    @Column(name = "quote_currency", nullable = false, length = 10)
    private String quoteCurrency;

    @Column(name = "fee_rate", nullable = false, precision = 10, scale = 6)
    private BigDecimal feeRate = BigDecimal.valueOf(0.001000);

    @Column(name = "price_decimals")
    private Integer priceDecimals = 2;

    @Column(name = "min_qty", precision = 20, scale = 8)
    private BigDecimal minQty = BigDecimal.valueOf(0.0001);

    @Column(name = "status", length = 20)
    private String status = "ACTIVE";

    @Column(name = "listing_price")
    private Long listingPrice = 0L;

    public Market() {}

    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }

    public String getBaseCurrency() { return baseCurrency; }
    public void setBaseCurrency(String baseCurrency) { this.baseCurrency = baseCurrency; }

    public String getQuoteCurrency() { return quoteCurrency; }
    public void setQuoteCurrency(String quoteCurrency) { this.quoteCurrency = quoteCurrency; }

    public BigDecimal getFeeRate() { return feeRate; }
    public void setFeeRate(BigDecimal feeRate) { this.feeRate = feeRate; }

    public Integer getPriceDecimals() { return priceDecimals; }
    public void setPriceDecimals(Integer priceDecimals) { this.priceDecimals = priceDecimals; }

    public BigDecimal getMinQty() { return minQty; }
    public void setMinQty(BigDecimal minQty) { this.minQty = minQty; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getListingPrice() { return listingPrice; }
    public void setListingPrice(Long listingPrice) { this.listingPrice = listingPrice; }
}
