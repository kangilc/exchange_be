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

    public List<TradeRepository.TradeStatsProjection> getTradeStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return tradeRepository.getTradeStats(timeBucket);
    }

    public List<LedgerJournalRepository.LedgerStatsProjection> getLedgerStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return ledgerJournalRepository.getLedgerStats(timeBucket);
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
