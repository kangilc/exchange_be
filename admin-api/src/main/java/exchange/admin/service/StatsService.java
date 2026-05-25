package exchange.admin.service;

import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.TradeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StatsService {

    @Autowired
    private TradeRepository tradeRepository;

    @Autowired
    private LedgerJournalRepository ledgerJournalRepository;

    @Autowired
    private exchange.admin.repository.UserRepository userRepository;

    @Autowired
    private exchange.admin.repository.WalletRepository walletRepository;

    public List<TradeRepository.TradeStatsProjection> getTradeStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return tradeRepository.getTradeStats(timeBucket);
    }

    public List<LedgerJournalRepository.LedgerStatsProjection> getLedgerStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return ledgerJournalRepository.getLedgerStats(timeBucket);
    }

    public List<exchange.admin.repository.UserRepository.UserStatsProjection> getUserStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return userRepository.getUserStats(timeBucket);
    }

    public java.util.Map<String, Object> getSummaryStats() {
        java.util.Map<String, Object> summary = new java.util.HashMap<>();
        summary.put("totalUsers", userRepository.count());
        summary.put("totalTrades", tradeRepository.getTotalTradeCount());
        summary.put("totalVolume", tradeRepository.getTotalTradeVolume());
        summary.put("totalWallets", walletRepository.count());
        return summary;
    }


    private String mapResolutionToBucket(String resolution) {
        if (resolution == null) {
            return "day";
        }
        switch (resolution.toLowerCase()) {
            case "weekly":
            case "week":
                return "week";
            case "monthly":
            case "month":
                return "month";
            case "quarterly":
            case "quarter":
                return "quarter";
            case "annual":
            case "annually":
            case "year":
                return "year";
            case "daily":
            case "day":
            default:
                return "day";
        }
    }
}
