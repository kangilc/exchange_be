package exchange.admin.dto.response;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 원장(Ledger) 상세 내역 조회를 위한 DTO 클래스.
 * MyBatis 쿼리 결과를 매핑함.
 */
@Data
public class DetailedLedgerODT {
    // 원장 고유 식별자
    private Long journalId;
    
    // 사용자 고유 식별자
    private Long userId;
    
    // 사용자 이메일 계정
    private String email;
    
    // 대상 자산/통화 코드 (예: BTC, KRW)
    private String currency;
    
    // 변동 수량 및 금액
    private BigDecimal amount;
    
    // 원장 변동 타입 (DEPOSIT, WITHDRAWAL 등)
    private String type;
    
    // 참조 거래/입출금 ID
    private Long referenceId;
    
    // 생성 일시
    private LocalDateTime createdAt;
}
