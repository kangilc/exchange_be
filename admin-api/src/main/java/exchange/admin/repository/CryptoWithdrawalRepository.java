package exchange.admin.repository;

import exchange.admin.model.CryptoWithdrawal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;

@Repository
public interface CryptoWithdrawalRepository extends JpaRepository<CryptoWithdrawal, Long> {
    List<CryptoWithdrawal> findByUserId(Long userId);
    List<CryptoWithdrawal> findByStatus(String status);
    List<CryptoWithdrawal> findAllByOrderByCreatedAtDesc();
    Page<CryptoWithdrawal> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
