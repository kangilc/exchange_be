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

    /**
     * 특정 종목의 다중 시간 해상도(1m, 5m, 15m, 1h)에 맞춰 집계된 OHLCV 캔들 목록을 반환합니다.
     * 프론트엔드 TradingView 차트와 연동되어 과거 시세를 고속 렌더링하기 위해 사용됩니다.
     * 한글 주석을 자세하게 추가하여 가독성을 높였습니다.
     */
    @GetMapping("/candles")
    public ResponseEntity<List<java.util.Map<String, Object>>> getCandles(
            @RequestParam("symbol") String symbol,
            @RequestParam(value = "resolution", defaultValue = "1m") String resolution,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        // StatsService의 온더플라이 캔들 집계 기능을 호출하여 결과를 반환합니다.
        return ResponseEntity.ok(statsService.getCandleStats(symbol, resolution, limit));
    }
}

