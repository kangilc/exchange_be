package exchange.admin.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "market_histories")
public class MarketHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Long historyId;

    @Column(name = "symbol", nullable = false, length = 20)
    private String symbol;

    @Column(name = "fee_rate", nullable = false, precision = 10, scale = 6)
    private BigDecimal feeRate;

    @Column(name = "price_decimals", nullable = false)
    private Integer priceDecimals;

    @Column(name = "min_amt", nullable = false, precision = 20, scale = 8)
    private BigDecimal minAmt;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    public MarketHistory() {}
}
