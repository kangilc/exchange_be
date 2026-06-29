package exchange.admin.controller;

import exchange.admin.dto.ApiResponse;
import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.TradeRepository;
import exchange.admin.service.StatsService;
import org.springframework.http.HttpStatus;
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
     * 기간 필터링(startDate, endDate)을 지원하며 파라미터 누락 시 최근 30일 데이터를 기본으로 조회함.
     * 
     * @param resolution 시간 해상도 (daily 등)
     * @param startDate 조회 시작일 (yyyy-MM-dd'T'HH:mm:ss 형식)
     * @param endDate 조회 종료일 (yyyy-MM-dd'T'HH:mm:ss 형식)
     * @return 체결 거래 통계 목록
     */
    @GetMapping("/trades")
    public ResponseEntity<ApiResponse<List<exchange.admin.dto.TradeStatsDto>>> getTradeStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution,
            @RequestParam(value = "startDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startDate,
            @RequestParam(value = "endDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime endDate) {
        
        java.time.LocalDateTime finalEndDate = endDate != null ? endDate : java.time.LocalDateTime.now();
        java.time.LocalDateTime finalStartDate = startDate != null ? startDate : finalEndDate.minusDays(30);
        
        return ApiResponse.ok(statsService.getTradeStats(resolution, finalStartDate, finalEndDate));
    }

    /**
     * 시간 해상도별 자산 원장 변동 통계 조회.
     * 
     * @param resolution 시간 해상도 (daily 등)
     * @return 자산 변동 통계 목록
     */
    @GetMapping("/assets")
    public ResponseEntity<ApiResponse<List<LedgerJournalRepository.LedgerStatsProjection>>> getLedgerStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ApiResponse.ok(statsService.getLedgerStats(resolution));
    }

    /**
     * 시간 해상도별 회원 가입 및 활성화 추이 통계 조회.
     * 
     * @param resolution 시간 해상도 (daily 등)
     * @return 회원 지표 통계 목록
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<exchange.admin.repository.UserRepository.UserStatsProjection>>> getUserStats(
            @RequestParam(value = "resolution", defaultValue = "daily") String resolution) {
        return ApiResponse.ok(statsService.getUserStats(resolution));
    }

    /**
     * 어드민 대시보드용 종합 요약 지표 조회.
     * 
     * @return 회원 수, 체결 수, 현재가 등의 종합 요약 정보
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getSummaryStats() {
        return ApiResponse.ok(statsService.getSummaryStats());
    }

    /**
     * 거래소 운영 실적 및 KPI 분석 통계 조회.
     * 
     * @return 수수료 수익, DAU/MAU, 거래 회전율 등의 실적 지표 정보
     */
    @GetMapping("/performance")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getPerformanceStats() {
        return ApiResponse.ok(statsService.getPerformanceStats());
    }

    /**
     * 특정 종목의 현재가(티커) 및 전일 종가 조회.
     * 
     * @param symbol 종목 심볼 (예: BTC-USD)
     * @return 종목 코드, 현재가, 전일종가 정보를 담은 맵
     */
    @GetMapping("/ticker")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getTicker(@RequestParam("symbol") String symbol) {
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("symbol", symbol);
        response.put("lastPrice", statsService.getLastPrice(symbol));
        response.put("prevClosePrice", statsService.getPrevClosePrice(symbol));
        return ApiResponse.ok(response);
    }

    /**
     * 전체 ACTIVE 마켓에 대한 티커 정보 벌크 조회.
     */
    @GetMapping("/tickers")
    public ResponseEntity<ApiResponse<List<java.util.Map<String, Object>>>> getTickers() {
        return ApiResponse.ok(statsService.getTickers());
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
    public ResponseEntity<ApiResponse<List<java.util.Map<String, Object>>>> getCandles(
            @RequestParam("symbol") String symbol,
            @RequestParam(value = "resolution", defaultValue = "1m") String resolution,
            @RequestParam(value = "limit", defaultValue = "100") int limit) {
        // StatsService의 온더플라이 캔들 집계 기능을 호출하여 반환함
        return ApiResponse.ok(statsService.getCandleStats(symbol, resolution, limit));
    }
}


