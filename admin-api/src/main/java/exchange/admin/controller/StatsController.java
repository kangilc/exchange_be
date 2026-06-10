package exchange.admin.controller;

import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.TradeRepository;
import exchange.admin.service.StatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 어드민 종합 통계 및 지표 관리 컨트롤러.
 * 거래소 요약 지표, 회원 가입 추이, 마켓 체결 통계 및 차트용 캔들 데이터 조회를 제공한다.
 */
@RestController
@RequestMapping("/admin/stats")
@CrossOrigin(origins = "*")
public class StatsController {

    private final StatsService statsService;

    // 생성자 주입
    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    /**
     * 시간 해상도별 체결 거래 통계 조회.
     * 
     * @param resolution 시간 해상도 (daily 등)
     * @return 체결 거래 통계 목록
     */
    @GetMapping("/trades")
    public ResponseEntity<List<TradeRepository.TradeStatsProjection>> getTradeStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ResponseEntity.ok(statsService.getTradeStats(resolution));
    }

    /**
     * 시간 해상도별 자산 원장 변동 통계 조회.
     * 
     * @param resolution 시간 해상도 (daily 등)
     * @return 자산 변동 통계 목록
     */
    @GetMapping("/assets")
    public ResponseEntity<List<LedgerJournalRepository.LedgerStatsProjection>> getLedgerStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ResponseEntity.ok(statsService.getLedgerStats(resolution));
    }

    /**
     * 시간 해상도별 회원 가입 및 활성화 추이 통계 조회.
     * 
     * @param resolution 시간 해상도 (daily 등)
     * @return 회원 지표 통계 목록
     */
    @GetMapping("/users")
    public ResponseEntity<List<exchange.admin.repository.UserRepository.UserStatsProjection>> getUserStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ResponseEntity.ok(statsService.getUserStats(resolution));
    }

    /**
     * 어드민 대시보드용 종합 요약 지표 조회.
     * 
     * @return 회원 수, 체결 수, 현재가 등의 종합 요약 정보
     */
    @GetMapping("/summary")
    public ResponseEntity<java.util.Map<String, Object>> getSummaryStats() {
        return ResponseEntity.ok(statsService.getSummaryStats());
    }

    /**
     * 거래소 운영 실적 및 KPI 분석 통계 조회.
     * 
     * @return 수수료 수익, DAU/MAU, 거래 회전율 등의 실적 지표 정보
     */
    @GetMapping("/performance")
    public ResponseEntity<java.util.Map<String, Object>> getPerformanceStats() {
        return ResponseEntity.ok(statsService.getPerformanceStats());
    }

    /**
     * 특정 종목의 현재가(티커) 조회.
     * 
     * @param symbol 종목 심볼 (예: BTC-USD)
     * @return 종목 코드 및 현재가 정보를 담은 맵
     */
    @GetMapping("/ticker")
    public ResponseEntity<java.util.Map<String, Object>> getTicker(@RequestParam("symbol") String symbol) {
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("symbol", symbol);
        response.put("lastPrice", statsService.getLastPrice(symbol));
        return ResponseEntity.ok(response);
    }

    /**
     * 특정 종목의 차트용 OHLCV 캔들 목록 조회.
     * TradingView 차트 연동을 위한 과거 분/시간봉 데이터를 반환한다.
     * 
     * @param symbol     종목 심볼
     * @param resolution 시간 해상도 (기본값 1m)
     * @param limit      최대 조회 캔들 개수 (기본값 100)
     * @return OHLCV 캔들 목록
     */
    @GetMapping("/candles")
    public ResponseEntity<List<java.util.Map<String, Object>>> getCandles(
            @RequestParam("symbol") String symbol,
            @RequestParam(value = "resolution", defaultValue = "1m") String resolution,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        // StatsService의 온더플라이 캔들 집계 기능을 호출하여 반환함
        return ResponseEntity.ok(statsService.getCandleStats(symbol, resolution, limit));
    }
}


