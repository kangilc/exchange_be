package exchange.admin.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "crypto_withdrawals")
public class CryptoWithdrawal extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "withdrawal_id")
    private Long withdrawalId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Column(name = "amount", nullable = false, precision = 36, scale = 18)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(name = "to_address", nullable = false, length = 100)
    private String toAddress;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED, BROADCASTED, SUCCESS, FAILED

    @Column(name = "confirmations", nullable = false)
    private int confirmations = 0;

    @Column(name = "tx_hash", length = 100)
    private String txHash;

    public CryptoWithdrawal() {}

    public Long getWithdrawalId() { return withdrawalId; }
    public void setWithdrawalId(Long withdrawalId) { this.withdrawalId = withdrawalId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getToAddress() { return toAddress; }
    public void setToAddress(String toAddress) { this.toAddress = toAddress; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getConfirmations() { return confirmations; }
    public void setConfirmations(int confirmations) { this.confirmations = confirmations; }

    public String getTxHash() { return txHash; }
    public void setTxHash(String txHash) { this.txHash = txHash; }
}
