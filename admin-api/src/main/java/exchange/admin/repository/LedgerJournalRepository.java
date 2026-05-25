package exchange.admin.repository;

import exchange.admin.model.LedgerJournal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LedgerJournalRepository extends JpaRepository<LedgerJournal, Long> {

    interface LedgerStatsProjection {
        String getBucket();
        String getCurrency();
        String getType();
        Long getEntryCount();
        Double getTotalAmount();
    }

    @Query(value = "SELECT " +
            "to_char(date_trunc(:timeBucket, created_at), 'YYYY-MM-DD HH24:MI:SS') as bucket, " +
            "currency as currency, " +
            "type as type, " +
            "COUNT(journal_id) as entryCount, " +
            "CAST(SUM(amount) AS double precision) as totalAmount " +
            "FROM ledger_journal " +
            "GROUP BY 1, 2, 3 " +
            "ORDER BY 1 DESC, 2, 3", nativeQuery = true)
    List<LedgerStatsProjection> getLedgerStats(@Param("timeBucket") String timeBucket);
}

