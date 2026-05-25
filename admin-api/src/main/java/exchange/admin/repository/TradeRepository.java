package exchange.admin.repository;

import exchange.admin.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TradeRepository extends JpaRepository<Trade, Long> {

    interface TradeStatsProjection {
        String getBucket();
        Long getTradeCount();
        Long getTotalQty();
        Double getAvgPrice();
        Double getTotalVolume();
    }

    @Query(value = "SELECT " +
            "to_char(date_trunc(:timeBucket, executed_at), 'YYYY-MM-DD HH24:MI:SS') as bucket, " +
            "COUNT(trade_id) as tradeCount, " +
            "SUM(qty) as totalQty, " +
            "CAST(AVG(price) AS double precision) as avgPrice, " +
            "CAST(SUM(qty * (price / 100.0)) AS double precision) as totalVolume " +
            "FROM trades " +
            "GROUP BY date_trunc(:timeBucket, executed_at) " +
            "ORDER BY date_trunc(:timeBucket, executed_at) DESC", nativeQuery = true)
    List<TradeStatsProjection> getTradeStats(@Param("timeBucket") String timeBucket);
}
