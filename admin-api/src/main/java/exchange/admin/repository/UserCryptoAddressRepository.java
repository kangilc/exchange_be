package exchange.admin.repository;

import exchange.admin.model.UserCryptoAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserCryptoAddressRepository extends JpaRepository<UserCryptoAddress, Long> {
    List<UserCryptoAddress> findByUserId(Long userId);
    Optional<UserCryptoAddress> findByUserIdAndCurrency(Long userId, String currency);
    Optional<UserCryptoAddress> findByCryptoAddress(String cryptoAddress);
    Optional<UserCryptoAddress> findByCryptoAddressIgnoreCase(String cryptoAddress);
}
