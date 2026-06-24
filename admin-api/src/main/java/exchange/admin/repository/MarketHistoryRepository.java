package exchange.admin.repository;

import exchange.admin.model.MarketHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MarketHistoryRepository extends JpaRepository<MarketHistory, Long> {
}
