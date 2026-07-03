package exchange.admin.dto.request.wallet;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * 사용자 암호화폐 출금 신청 요청을 위한 IDT (Input Data Transfer) 객체
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WithdrawRequestIDT {
    /** 사용자 식별 ID */
    private Long userId;
    /** 자산 통화 종류 (BTC, ADA, JAF 등) */
    private String currency;
    /** 출금 신청 금액 */
    private BigDecimal amount;
    /** 출금 대상 지갑 주소 */
    private String toAddress;
}
