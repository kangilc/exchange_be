package exchange.admin.mapper;

import exchange.admin.dto.response.DetailedLedgerODT;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 원장(Ledger) 조회를 담당하는 MyBatis 매퍼 인터페이스.
 * 복잡한 동적 검색 및 조인 쿼리를 처리함.
 */
@Mapper
public interface LedgerJournalMapper {
    /**
     * 입출금 및 자산 변경 원장 상세 내역 조회 (검색 및 기간 필터 포함).
     *
     * @param search 검색 키워드 (이메일 등)
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @param offset 페이징 오프셋
     * @param limit 조회할 개수
     * @return 원장 내역 목록
     */
    List<DetailedLedgerODT> selectDetailedLedgers(
            @Param("search") String search,
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate,
            @Param("offset") int offset, 
            @Param("limit") int limit);
            
    /**
     * 조건에 맞는 전체 원장 개수 조회 (검색 및 기간 필터 포함).
     *
     * @param search 검색 키워드
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @return 총 개수
     */
    long countDetailedLedgers(
            @Param("search") String search,
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate);
    
    /**
     * 특정 유저의 원장 상세 내역 조회 (기간 필터 포함).
     *
     * @param userId 사용자 ID
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @param offset 페이징 오프셋
     * @param limit 조회할 개수
     * @return 특정 유저의 원장 내역 목록
     */
    List<DetailedLedgerODT> selectDetailedLedgersByUserId(
            @Param("userId") Long userId, 
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate,
            @Param("offset") int offset, 
            @Param("limit") int limit);
            
    /**
     * 특정 사용자의 원장 데이터 총 개수를 조회함.
     *
     * @param userId 사용자 ID
     * @return 총 데이터 개수
     */
    long countDetailedLedgersByUserId(@Param("userId") Long userId);
    
    /**
     * 자산 원장 변동 통계 (시간 해상도별) 조회.
     *
     * @param timeBucket 시간 해상도
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @return 자산 변동 통계 목록
     */
    List<exchange.admin.dto.response.LedgerStatsODT> selectLedgerStats(
            @Param("timeBucket") String timeBucket,
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate);
}
