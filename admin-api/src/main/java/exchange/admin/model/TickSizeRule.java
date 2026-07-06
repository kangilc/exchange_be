package exchange.admin.model;

import jakarta.persistence.*;
import java.util.List;

/**
 * 📋 호가 단위 정책 그룹 JPA 엔티티 클래스
 * 
 * - 마켓별 호가 정책의 마스터 정보(예: USD 표준, KRW 표준 등)를 나타냄.
 * - 하위 세부 가격대별 정책들(TickSizeLevel)을 일대다(Eager) 관계로 포함하며 가격 낮은 순으로 정렬 보장함.
 */
@Entity
@Table(name = "tick_size_rules")
public class TickSizeRule extends BaseEntity {

    // 정책 식별자 고유 ID
    @Id
    @Column(name = "rule_id", length = 50)
    private String ruleId;

    // 정책 명칭
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    // 해당 정책에 연결된 세부 가격대별 호가 단위 목록 (가격 낮은 순 정렬)
    @OneToMany(fetch = FetchType.EAGER)
    @JoinColumn(name = "rule_id", referencedColumnName = "rule_id", insertable = false, updatable = false)
    @OrderBy("priceAbove ASC")
    private List<TickSizeLevel> levels;

    // 기본 생성자
    public TickSizeRule() {}

    public String getRuleId() { return ruleId; }
    public void setRuleId(String ruleId) { this.ruleId = ruleId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<TickSizeLevel> getLevels() { return levels; }
    public void setLevels(List<TickSizeLevel> levels) { this.levels = levels; }
}
