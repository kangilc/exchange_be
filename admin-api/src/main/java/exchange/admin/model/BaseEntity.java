package exchange.admin.model;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

/**
 * 모든 영속성 엔티티가 상속받는 기본 엔티티 클래스입니다.
 * JPA Auditing 기능을 활용하여 엔티티 생성일시, 수정일시, 생성자(Auditor), 수정자(Auditor)를 공통으로 관리합니다.
 */
@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;

    // 레거시 코드 호환용 헬퍼 메소드 (직접 set/get 하는 부분 대응)
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    // Trade.executedAt 호환용 헬퍼 메소드
    public LocalDateTime getExecutedAt() {
        return this.createdAt;
    }

    public void setExecutedAt(LocalDateTime executedAt) {
        this.createdAt = executedAt;
    }
}
