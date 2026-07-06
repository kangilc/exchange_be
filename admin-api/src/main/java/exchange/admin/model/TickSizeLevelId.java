package exchange.admin.model;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * 🔑 가격대별 호가 단위 세부 설정의 복합 기본키 식별자 클래스
 * 
 * - 데이터베이스의 복합 PK(rule_id, price_above)에 대응하기 위해 구현함.
 * - Serializable 인터페이스를 구현하며 equals 및 hashCode 메서드를 재정의함.
 */
public class TickSizeLevelId implements Serializable {
    // 정책 그룹 식별자 ID
    private String ruleId;
    // 적용 시작 가격 경계값
    private BigDecimal priceAbove;

    // 기본 생성자
    public TickSizeLevelId() {}

    // 필드 초기화 생성자
    public TickSizeLevelId(String ruleId, BigDecimal priceAbove) {
        this.ruleId = ruleId;
        this.priceAbove = priceAbove;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TickSizeLevelId that = (TickSizeLevelId) o;
        return Objects.equals(ruleId, that.ruleId) && Objects.equals(priceAbove, that.priceAbove);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ruleId, priceAbove);
    }
}
