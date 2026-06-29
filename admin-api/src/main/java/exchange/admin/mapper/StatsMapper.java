package exchange.admin.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface StatsMapper {

    /**
     * 특정 기간 이후의 수수료 수익 및 거래량 조회 (마켓별 그룹핑)
     * 
     * @param since 조회 시작 기준 시간
     * @return 마켓 심볼(symbol), 결제 통화(quote_currency), 거래량(volume), 수수료(fees) 등 정보를 담은 목록
     */
    List<java.util.Map<String, Object>> selectFeeRevenue(@Param("since") java.time.LocalDateTime since);

    /**
     * 전체 누적 수수료 수익 및 거래량 조회 (마켓별 그룹핑)
     * 
     * @return 마켓 심볼(symbol), 거래량(volume), 누적 수수료(fees) 등 정보를 담은 목록
     */
    List<java.util.Map<String, Object>> selectTotalFeeRevenue();

    /**
     * 특정 기간 이후의 활성 사용자 수(DAU/MAU) 조회
     */
    long selectActiveUsersCount(@Param("since") java.time.LocalDateTime since);

    /**
     * 특정 기간 이후의 통화별 순 입출금 흐름(Net Flow) 조회
     */
    List<Map<String, Object>> selectNetDepositFlow(@Param("since") java.time.LocalDateTime since);

    /**
     * 통화별 지갑 총 자산 잔액 조회
     */
    List<Map<String, Object>> selectTotalBalances();

    /**
     * 30일 누적 거래량 조회 (마켓별 리스트)
     * 
     * @return 마켓 심볼(symbol), 결제 통화(quote_currency), 누적 거래량(volume)을 담은 목록
     */
    List<java.util.Map<String, Object>> selectVolume30d();

    /**
     * 특정 기간 이후의 주문 상태별(FILLED, CANCELLED, ACTIVE) 개수 조회
     */
    Map<String, Object> selectOrderFillRate(@Param("since") java.time.LocalDateTime since);

    /**
     * 특정 마켓의 시간 해상도별 OHLCV 캔들 집계
     */
    List<Map<String, Object>> selectCandleStats(
            @Param("symbol") String symbol,
            @Param("bucketSizeSeconds") long bucketSizeSeconds,
            @Param("limit") int limit,
            @Param("tradeLimit") int tradeLimit);
}
