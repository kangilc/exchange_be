package exchange.admin.repository;

import exchange.admin.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

/**
 * 회원(User) 테이블에 접근하는 JPA Repository 인터페이스입니다.
 * 이메일을 통한 단건 조회 및 시간축 버킷 단위 가입자 통계 조회를 지원합니다.
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    interface UserStatsProjection {
        String getBucket();

        Long getUserCount();
    }

    @Query(value = "SELECT " +
            "to_char(date_trunc(:timeBucket, created_at), 'YYYY-MM-DD HH24:MI:SS') as bucket, " +
            "COUNT(user_id) as userCount " +
            "FROM users " +
            "GROUP BY 1 " +
            "ORDER BY 1 DESC", nativeQuery = true)
    List<UserStatsProjection> getUserStats(@Param("timeBucket") String timeBucket);
}
