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



    interface DetailedLedgerProjection {
                Long getJournalId();

                Long getUserId();

                String getEmail();

                String getCurrency();

                java.math.BigDecimal getAmount();

                String getType();

                Long getReferenceId();

                java.time.LocalDateTime getCreatedAt();
        }

        @Query(value = "SELECT l.journal_id as journalId, l.user_id as userId, u.email as email, " +
                        "l.currency as currency, l.amount as amount, l.type as type, " +
                        "l.reference_id as referenceId, l.created_at as createdAt " +
                        "FROM ledger_journal l " +
                        "JOIN users u ON l.user_id = u.user_id " +
                        "WHERE l.type IN ('DEPOSIT', 'WITHDRAWAL') " +
                        "AND (CAST(:search AS text) IS NULL OR u.email LIKE :search OR CAST(l.user_id AS VARCHAR) LIKE :search OR l.currency LIKE :search) "
                        +
                        "ORDER BY l.created_at DESC", countQuery = "SELECT COUNT(*) FROM ledger_journal l JOIN users u ON l.user_id = u.user_id WHERE l.type IN ('DEPOSIT', 'WITHDRAWAL') AND (CAST(:search AS text) IS NULL OR u.email LIKE :search OR CAST(l.user_id AS VARCHAR) LIKE :search OR l.currency LIKE :search)", nativeQuery = true)
        org.springframework.data.domain.Page<DetailedLedgerProjection> findAllDetailedLedgers(
                        @Param("search") String search, org.springframework.data.domain.Pageable pageable);

        @Query(value = "SELECT l.journal_id as journalId, l.user_id as userId, u.email as email, " +
                        "l.currency as currency, l.amount as amount, l.type as type, " +
                        "l.reference_id as referenceId, l.created_at as createdAt " +
                        "FROM ledger_journal l " +
                        "JOIN users u ON l.user_id = u.user_id " +
                        "WHERE l.user_id = :userId AND l.type IN ('DEPOSIT', 'WITHDRAWAL') " +
                        "ORDER BY l.created_at DESC", countQuery = "SELECT COUNT(*) FROM ledger_journal l WHERE l.user_id = :userId AND l.type IN ('DEPOSIT', 'WITHDRAWAL')", nativeQuery = true)
        org.springframework.data.domain.Page<DetailedLedgerProjection> findDetailedLedgersByUserId(
                        @Param("userId") Long userId, org.springframework.data.domain.Pageable pageable);
}
