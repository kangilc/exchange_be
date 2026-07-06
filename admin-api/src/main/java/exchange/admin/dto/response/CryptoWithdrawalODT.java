package exchange.admin.dto.response;

import exchange.admin.model.CryptoWithdrawal;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 암호화폐 출금 신청 내역 응답용 DTO 클래스.
 */
@Getter
@Setter
public class CryptoWithdrawalODT {
    private Long withdrawalId;
    private Long userId;
    private String currency;
    private BigDecimal amount;
    private String toAddress;
    private String status;
    private int confirmations;
    private String txHash;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public CryptoWithdrawalODT() {
    }

    /**
     * 엔티티 객체로부터 DTO 객체를 생성함.
     *
     * @param withdrawal 출금 엔티티
     */
    public CryptoWithdrawalODT(CryptoWithdrawal withdrawal) {
        if (withdrawal != null) {
            this.withdrawalId = withdrawal.getWithdrawalId();
            this.userId = withdrawal.getUserId();
            this.currency = withdrawal.getCurrency();
            this.amount = withdrawal.getAmount();
            this.toAddress = withdrawal.getToAddress();
            this.status = withdrawal.getStatus();
            this.confirmations = withdrawal.getConfirmations();
            this.txHash = withdrawal.getTxHash();
            this.createdAt = withdrawal.getCreatedAt();
            this.updatedAt = withdrawal.getUpdatedAt();
        }
    }
}
