package exchange.admin.mapper;

import exchange.admin.dto.UserStatsDto;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserMapper {
    /**
     * 시간대별 회원 가입 통계를 조회함.
     *
     * @param timeBucket 시간 해상도 (예: hour, day)
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @return 회원 가입 통계 목록
     */
    List<UserStatsDto> selectUserStats(
            @Param("timeBucket") String timeBucket,
            @Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate);
}
