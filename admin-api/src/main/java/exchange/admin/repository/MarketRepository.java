package exchange.admin.repository;

import exchange.admin.model.Market;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;

@Repository
public interface MarketRepository extends JpaRepository<Market, String> {
    List<Market> findByStatus(String status);
    Page<Market> findByStatus(String status, Pageable pageable);
}
