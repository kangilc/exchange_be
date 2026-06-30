package exchange.admin.mapper;

import exchange.admin.dto.response.TradeStatsODT;
import exchange.admin.dto.response.UserTradeODT;
import exchange.admin.model.Trade;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 체결 내역(Trade) 조회를 담당하는 MyBatis 매퍼 인터페이스.
 * 복잡한 통계 및 조인 쿼리를 처리함.
 */
@Mapper
public interface TradeMapper {

    /**
     * 시간대별 체결 통계를 조회함.
     *
     * @param timeBucket 시간 해상도 (예: hour, day)
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @return 체결 통계 목록
     */
    List<TradeStatsODT> selectTradeStats(
            @Param("timeBucket") String timeBucket,
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate);

    /**
     * 특정 유저의 체결 내역 목록을 페이징하여 조회함.
     *
     * @param userId 사용자 ID
     * @param offset 페이징 오프셋
     * @param limit 조회할 개수
     * @return 유저 체결 내역 목록
     */
    List<UserTradeODT> selectUserTrades(
            @Param("userId") Long userId, 
            @Param("offset") int offset, 
            @Param("limit") int limit);

    /**
     * 특정 유저의 전체 체결 내역 개수를 조회함.
     *
     * @param userId 사용자 ID
     * @return 총 체결 건수
     */
    long countUserTrades(@Param("userId") Long userId);

    /**
     * 전체 거래소의 누적 거래 대금(볼륨)을 조회함.
     *
     * @return 누적 거래 볼륨
     */
    Double selectTotalTradeVolume();

    /**
     * 특정 기준 시간 이전의 가장 최근 체결 내역을 단건 조회함.
     *
     * @param symbol 자산 심볼
     * @param cutoff 기준 일시
     * @return 가장 최근 체결 단건 내역
     */
    Trade selectLatestTradeBeforeCutoff(
            @Param("symbol") String symbol, 
            @Param("cutoff") LocalDateTime cutoff);

    /**
     * 특정 마켓의 가장 첫 번째(오래된) 체결 내역을 조회함.
     *
     * @param symbol 자산 심볼
     * @return 첫 체결 단건 내역
     */
    Trade selectFirstTrade(@Param("symbol") String symbol);
}
