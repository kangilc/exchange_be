package exchange.admin.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

/**
 * 📊 가격대별 호가 단위 세부 설정 JPA 엔티티 클래스
 * 
 * - 특정 정책 그룹에 속하여 특정 가격 이상일 때 적용될 호가 단위를 정의함.
 * - 복합 기본키(rule_id, price_above)를 사용하며 TickSizeLevelId 식별자 클래스와 매핑됨.
 */
@Entity
@Table(name = "tick_size_levels")
@IdClass(TickSizeLevelId.class)
public class TickSizeLevel extends BaseEntity {

    // 정책 식별자 ID (tick_size_rules 테이블의 rule_id 참조)
    @Id
    @Column(name = "rule_id", length = 50)
    private String ruleId;

    // 적용 시작 가격 경계값 (해당 가격 이상일 때 이 호가 단위를 적용)
    @Id
    @Column(name = "price_above", precision = 36, scale = 18)
    private BigDecimal priceAbove;

    // 해당 구간의 호가 단위 크기 (실제 변동 틱 단위)
    @Column(name = "tick_size", nullable = false, precision = 36, scale = 18)
    private BigDecimal tickSize;

    // 기본 생성자
    public TickSizeLevel() {}

    public String getRuleId() { return ruleId; }
    public void setRuleId(String ruleId) { this.ruleId = ruleId; }

    public BigDecimal getPriceAbove() { return priceAbove; }
    public void setPriceAbove(BigDecimal priceAbove) { this.priceAbove = priceAbove; }

    public BigDecimal getTickSize() { return tickSize; }
    public void setTickSize(BigDecimal tickSize) { this.tickSize = tickSize; }
}
