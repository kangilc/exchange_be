package exchange.admin.dto.response;

import exchange.admin.model.Wallet;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 지갑 정보 응답용 DTO 클래스.
 */
@Getter
@Setter
public class WalletODT {
    private Long walletId;
    private Long userId;
    private String currency;
    private BigDecimal balance;
    private BigDecimal lockedBalance;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public WalletODT() {
    }

    /**
     * 엔티티 객체로부터 DTO 객체를 생성함.
     *
     * @param wallet 지갑 엔티티
     */
    public WalletODT(Wallet wallet) {
        if (wallet != null) {
            this.walletId = wallet.getWalletId();
            this.userId = wallet.getUserId();
            this.currency = wallet.getCurrency();
            this.balance = wallet.getBalance();
            this.lockedBalance = wallet.getLockedBalance();
            this.createdAt = wallet.getCreatedAt();
            this.updatedAt = wallet.getUpdatedAt();
        }
    }
}
