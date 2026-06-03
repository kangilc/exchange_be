package exchange.admin.repository;

import exchange.admin.model.SystemHotWallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SystemHotWalletRepository extends JpaRepository<SystemHotWallet, Long> {
    Optional<SystemHotWallet> findByCurrency(String currency);
}
