package exchange.admin.controller;

import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.TradeRepository;
import exchange.admin.service.StatsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/stats")
@CrossOrigin(origins = "*")
public class StatsController {

    @Autowired
    private StatsService statsService;

    @GetMapping("/trades")
    public ResponseEntity<List<TradeRepository.TradeStatsProjection>> getTradeStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ResponseEntity.ok(statsService.getTradeStats(resolution));
    }

    @GetMapping("/assets")
    public ResponseEntity<List<LedgerJournalRepository.LedgerStatsProjection>> getLedgerStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ResponseEntity.ok(statsService.getLedgerStats(resolution));
    }

    @GetMapping("/users")
    public ResponseEntity<List<exchange.admin.repository.UserRepository.UserStatsProjection>> getUserStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ResponseEntity.ok(statsService.getUserStats(resolution));
    }

    @GetMapping("/summary")
    public ResponseEntity<java.util.Map<String, Object>> getSummaryStats() {
        return ResponseEntity.ok(statsService.getSummaryStats());
    }

    @GetMapping("/ticker")
    public ResponseEntity<java.util.Map<String, Object>> getTicker(@RequestParam("symbol") String symbol) {
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("symbol", symbol);
        response.put("lastPrice", statsService.getLastPrice(symbol));
        return ResponseEntity.ok(response);
    }
}

