package exchange.admin.repository;

import exchange.admin.model.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {
    List<Wallet> findByUserId(Long userId);
    Optional<Wallet> findByUserIdAndCurrency(Long userId, String currency);

    interface CurrencySummary {
        String getCurrency();
        java.math.BigDecimal getTotalBalance();
        java.math.BigDecimal getTotalLocked();
    }

    @Query("SELECT w.currency as currency, SUM(w.balance) as totalBalance, SUM(w.lockedBalance) as totalLocked " +
           "FROM Wallet w GROUP BY w.currency")
    List<CurrencySummary> getCurrencySummary();
}
