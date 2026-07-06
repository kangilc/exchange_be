package exchange.admin.dto.response;

import exchange.admin.model.SystemHotWallet;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 시스템 핫월렛 정보 응답용 DTO 클래스.
 */
@Getter
@Setter
public class SystemHotWalletODT {
    private Long walletId;
    private String currency;
    private String cryptoAddress;
    private BigDecimal balance;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public SystemHotWalletODT() {
    }

    /**
     * 엔티티 객체로부터 DTO 객체를 생성함.
     *
     * @param wallet 시스템 핫월렛 엔티티
     */
    public SystemHotWalletODT(SystemHotWallet wallet) {
        if (wallet != null) {
            this.walletId = wallet.getWalletId();
            this.currency = wallet.getCurrency();
            this.cryptoAddress = wallet.getCryptoAddress();
            this.balance = wallet.getBalance();
            this.createdAt = wallet.getCreatedAt();
            this.updatedAt = wallet.getUpdatedAt();
        }
    }
}
