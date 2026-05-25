package exchange.admin.repository;

import exchange.admin.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

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


