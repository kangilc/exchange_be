package exchange.admin.dto.response;

import exchange.admin.model.UserCryptoAddress;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 사용자 가상 자산 입금용 주소 정보 응답용 DTO 클래스.
 */
@Getter
@Setter
public class UserCryptoAddressODT {
    private Long addressId;
    private Long userId;
    private String currency;
    private String cryptoAddress;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UserCryptoAddressODT() {
    }

    /**
     * 엔티티 객체로부터 DTO 객체를 생성함.
     *
     * @param address 사용자 가상 자산 주소 엔티티
     */
    public UserCryptoAddressODT(UserCryptoAddress address) {
        if (address != null) {
            this.addressId = address.getAddressId();
            this.userId = address.getUserId();
            this.currency = address.getCurrency();
            this.cryptoAddress = address.getCryptoAddress();
            this.createdAt = address.getCreatedAt();
            this.updatedAt = address.getUpdatedAt();
        }
    }
}
