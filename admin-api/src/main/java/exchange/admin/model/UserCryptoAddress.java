package exchange.admin.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_crypto_addresses", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "currency"}))
public class UserCryptoAddress extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "address_id")
    private Long addressId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Column(name = "crypto_address", nullable = false, unique = true, length = 100)
    private String cryptoAddress;

    public UserCryptoAddress() {}

    public Long getAddressId() { return addressId; }
    public void setAddressId(Long addressId) { this.addressId = addressId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getCryptoAddress() { return cryptoAddress; }
    public void setCryptoAddress(String cryptoAddress) { this.cryptoAddress = cryptoAddress; }
}
