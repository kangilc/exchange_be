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
            "GROUP BY 1 " +
            "ORDER BY 1 DESC", nativeQuery = true)
    List<TradeStatsProjection> getTradeStats(@Param("timeBucket") String timeBucket);


    interface UserTradeProjection {
        Long getTradeId();
        String getSymbol();
        Long getBuyOrderId();
        Long getSellOrderId();
        Long getPrice();
        Long getQty();
        java.time.LocalDateTime getExecutedAt();
        String getSide();
    }

    @Query(value = "SELECT t.trade_id as tradeId, t.symbol as symbol, " +
            "t.buy_order_id as buyOrderId, t.sell_order_id as sellOrderId, " +
            "t.price as price, t.qty as qty, t.executed_at as executedAt, " +
            "CASE WHEN o_buy.user_id = :userId THEN 'BUY' ELSE 'SELL' END as side " +
            "FROM trades t " +
            "JOIN orders o_buy ON t.buy_order_id = o_buy.order_id " +
            "JOIN orders o_sell ON t.sell_order_id = o_sell.order_id " +
            "WHERE o_buy.user_id = :userId OR o_sell.user_id = :userId " +
            "ORDER BY t.executed_at DESC", nativeQuery = true)
    List<UserTradeProjection> findUserTrades(@Param("userId") Long userId);

    @Query(value = "SELECT COUNT(trade_id) FROM trades", nativeQuery = true)
    Long getTotalTradeCount();

    @Query(value = "SELECT COALESCE(SUM(qty * (price / 100.0)), 0.0) FROM trades", nativeQuery = true)
    Double getTotalTradeVolume();
}

