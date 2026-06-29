package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.TradeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 거래소 통계 및 실시간 지표 분석 서비스.
 * 회원 수, 거래 횟수, 누적 거래 대금, 지갑 정보 및 캔들(봉) 데이터 집계 기능을 담당함.
 * 어드민 대시보드 성능 지표(수수료 수익, DAU/MAU, 원장 입출금 흐름 등) 산출을 지원함.
 */
@Service
public class StatsService {

    private final TradeRepository tradeRepository;
    private final exchange.admin.mapper.TradeMapper tradeMapper;
    private final LedgerJournalRepository ledgerJournalRepository;
    private final exchange.admin.repository.UserRepository userRepository;
    private final exchange.admin.repository.WalletRepository walletRepository;
    private final exchange.admin.repository.MarketRepository marketRepository;
    private final exchange.admin.mapper.UserMapper userMapper;
    private final exchange.admin.mapper.LedgerJournalMapper ledgerJournalMapper;
    private final exchange.admin.mapper.StatsMapper statsMapper;

    public StatsService(TradeRepository tradeRepository,
                        exchange.admin.mapper.TradeMapper tradeMapper,
                        LedgerJournalRepository ledgerJournalRepository,
                        exchange.admin.repository.UserRepository userRepository,
                        exchange.admin.repository.WalletRepository walletRepository,
                        exchange.admin.repository.MarketRepository marketRepository,
                        exchange.admin.mapper.UserMapper userMapper,
                        exchange.admin.mapper.LedgerJournalMapper ledgerJournalMapper,
                        exchange.admin.mapper.StatsMapper statsMapper) {
        this.tradeRepository = tradeRepository;
        this.tradeMapper = tradeMapper;
        this.ledgerJournalRepository = ledgerJournalRepository;
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
        this.marketRepository = marketRepository;
        this.userMapper = userMapper;
        this.ledgerJournalMapper = ledgerJournalMapper;
        this.statsMapper = statsMapper;
    }

    /**
     * 지정된 해상도(resolution) 단위로 그룹핑된 거래 통계 목록을 조회함.
     */
    public List<exchange.admin.dto.TradeStatsDto> getTradeStats(String resolution, java.time.LocalDateTime startDate, java.time.LocalDateTime endDate) {
        String timeBucket = mapResolutionToBucket(resolution);
        return tradeMapper.selectTradeStats(timeBucket, startDate, endDate);
    }

    /**
     * 지정된 해상도 단위로 그룹핑된 원장 변경 통계 목록을 조회함.
     */
    public List<exchange.admin.dto.LedgerStatsDto> getLedgerStats(String resolution, java.time.LocalDateTime startDate, java.time.LocalDateTime endDate) {
        String timeBucket = mapResolutionToBucket(resolution);
        return ledgerJournalMapper.selectLedgerStats(timeBucket, startDate, endDate);
    }

    /**
     * 지정된 해상도 단위로 그룹핑된 유저 가입 통계 목록을 조회함.
     */
    public List<exchange.admin.dto.UserStatsDto> getUserStats(String resolution, java.time.LocalDateTime startDate, java.time.LocalDateTime endDate) {
        String timeBucket = mapResolutionToBucket(resolution);
        return userMapper.selectUserStats(timeBucket, startDate, endDate);
    }

    private String mapResolutionToBucket(String resolution) {
        if (resolution == null) {
            return "day";
        }
        switch (resolution.toLowerCase()) {
            case "hourly": return "hour";
            case "weekly": return "week";
            case "monthly": return "month";
            case "quarterly": return "quarter";
            case "annual": return "year";
            case "daily":
            default: return "day";
        }
    }

    /**
     * 거래소 전반의 요약 통계를 집계함.
     */
    public java.util.Map<String, Object> getSummaryStats() {
        java.util.Map<String, Object> summary = new java.util.HashMap<>();
        summary.put("totalUsers", userRepository.count());
        summary.put("totalTrades", tradeRepository.getTotalTradeCount());
        summary.put("totalVolume", tradeMapper.selectTotalTradeVolume());
        summary.put("totalWallets", walletRepository.count());
        return summary;
    }

    /**
     * 특정 마켓 종목의 최종 체결 가격을 조회함.
     */
    @org.springframework.cache.annotation.Cacheable(value = "lastPrice")
    public Long getLastPrice(String symbol) {
        return tradeRepository.findFirstBySymbolOrderByTradeIdDesc(symbol)
                .map(exchange.admin.model.Trade::getPrice)
                .orElseGet(() -> marketRepository.findById(symbol)
                        .map(exchange.admin.model.Market::getListingPrice)
                        .orElse(0L));
    }

    /**
     * 특정 마켓 종목의 전일 종가(기준가)를 조회함. (오전 9시 정각 기준)
     */
    public Long getPrevClosePrice(String symbol) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.time.LocalDateTime cutoff = now.withHour(9).withMinute(0).withSecond(0).withNano(0);
        if (now.isBefore(cutoff)) {
            cutoff = cutoff.minusDays(1);
        }

        // 1. Cutoff 시점 이전의 마지막 거래
        exchange.admin.model.Trade latestTrade = tradeMapper.selectLatestTradeBeforeCutoff(symbol, cutoff);
        if (latestTrade != null) {
            return latestTrade.getPrice();
        }

        // 2. 없으면 전체 거래 중 최초 거래
        exchange.admin.model.Trade firstTrade = tradeMapper.selectFirstTrade(symbol);
        if (firstTrade != null) {
            return firstTrade.getPrice();
        }

        // 3. 그것도 없으면 DB markets 테이블의 listing_price 설정
        return marketRepository.findById(symbol)
                .map(exchange.admin.model.Market::getListingPrice)
                .orElse(0L);
    }

    /**
     * 전체 ACTIVE 마켓에 대한 티커 정보 벌크 조회.
     */
    public List<java.util.Map<String, Object>> getTickers() {
        List<exchange.admin.model.Market> activeMarkets = marketRepository.findByStatus("ACTIVE");
        List<java.util.Map<String, Object>> tickers = new java.util.ArrayList<>();
        for (exchange.admin.model.Market market : activeMarkets) {
            String symbol = market.getSymbol();
            java.util.Map<String, Object> ticker = new java.util.HashMap<>();
            ticker.put("symbol", symbol);
            ticker.put("lastPrice", getLastPrice(symbol));
            ticker.put("prevClosePrice", getPrevClosePrice(symbol));
            tickers.add(ticker);
        }
        return tickers;
    }

    /**
     * 특정 종목의 체결 내역(trades)을 기반으로 시계열 봉 데이터를 집계하여 반환함.
     */
    public List<java.util.Map<String, Object>> getCandleStats(String symbol, String resolution, int limit) {
        long bucketSizeSeconds = 60; // 기본값은 1분 (60초)
        if (resolution != null) {
            switch (resolution.toLowerCase()) {
                case "5m": bucketSizeSeconds = 300; break;
                case "15m": bucketSizeSeconds = 900; break;
                case "1h": bucketSizeSeconds = 3600; break;
                case "1w": bucketSizeSeconds = 604800; break;
                case "1mo": bucketSizeSeconds = 2592000; break;
                case "1y": bucketSizeSeconds = 31536000; break;
                case "1m":
                default: bucketSizeSeconds = 60; break;
            }
        }
        
        // MyBatis Mapper에 캔들(OHLCV) 집계 쿼리를 위임하여 결과를 조회함.
        // 캔들 생성 시 데이터가 방대해지는 것을 방지하기 위해 5만건 원천 데이터 제한을 파라미터로 주입함.
        int tradeLimit = 50000;
        List<java.util.Map<String, Object>> candles = statsMapper.selectCandleStats(symbol, bucketSizeSeconds, limit, tradeLimit);
        
        // 캔들은 최신부터 과거 순으로 조회되므로, 차트 렌더링(과거->최신)을 위해 순서를 역순으로 정렬함.
        if (candles != null) {
            java.util.Collections.reverse(candles);
        }
        
        return candles;
    }

    /**
     * 어드민 대시보드에서 활용하는 거래소 핵심 성능 및 재무 지표를 집계하여 산출함.
     */
    public java.util.Map<String, Object> getPerformanceStats() {
        java.util.Map<String, Object> perf = new java.util.HashMap<>();

        // 1. 수수료 수익 (누적 및 24시간)
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.time.LocalDateTime dayAgo = now.minusDays(1);
        java.time.LocalDateTime thirtyDaysAgo = now.minusDays(30);

        List<java.util.Map<String, Object>> totalFeesList = statsMapper.selectTotalFeeRevenue();
        List<java.util.Map<String, Object>> fees24hList = statsMapper.selectFeeRevenue(dayAgo);

        // 빠른 24H 데이터 조회를 위한 해시맵 생성
        java.util.Map<String, java.util.Map<String, Object>> fees24hMap = new java.util.HashMap<>();
        if (fees24hList != null) {
            for (java.util.Map<String, Object> f24 : fees24hList) {
                fees24hMap.put((String) f24.get("symbol"), f24);
            }
        }

        List<java.util.Map<String, Object>> feeRevenues = new java.util.ArrayList<>();
        if (totalFeesList != null) {
            for (java.util.Map<String, Object> totalRow : totalFeesList) {
                java.util.Map<String, Object> marketStat = new java.util.HashMap<>();
                String symbol = (String) totalRow.get("symbol");
                
                marketStat.put("symbol", symbol);
                marketStat.put("quoteCurrency", totalRow.get("quote_currency"));
                
                // DB의 수수료율보다 우선하는 AdminSettings 메모리의 실시간 수수료율 조회 적용
                double currentFeeRate = AdminSettings.getFeeRate(symbol);
                marketStat.put("currentFeeRate", currentFeeRate);
                
                marketStat.put("totalVolume", convertDouble(totalRow.get("volume")));
                marketStat.put("totalFees", convertDouble(totalRow.get("fees")));
                
                java.util.Map<String, Object> row24h = fees24hMap.get(symbol);
                marketStat.put("volume24h", row24h != null ? convertDouble(row24h.get("volume")) : 0.0);
                marketStat.put("fees24h", row24h != null ? convertDouble(row24h.get("fees")) : 0.0);
                
                feeRevenues.add(marketStat);
            }
        }
        perf.put("feeRevenues", feeRevenues);

        // 2. 활성 사용자 (DAU 24H / MAU 30D)
        long dau24h = statsMapper.selectActiveUsersCount(dayAgo);
        long mau30d = statsMapper.selectActiveUsersCount(thirtyDaysAgo);

        java.util.Map<String, Object> activeUsers = new java.util.HashMap<>();
        activeUsers.put("dau24h", dau24h);
        activeUsers.put("mau30d", mau30d);
        double dauMauRatio = mau30d > 0 ? (dau24h * 100.0 / mau30d) : 0.0;
        activeUsers.put("dauMauRatioPercent", Math.round(dauMauRatio * 100.0) / 100.0);
        perf.put("activeUsers", activeUsers);

        // 3. 순 입출금 흐름 (최근 30일)
        List<java.util.Map<String, Object>> netFlowsRaw = statsMapper.selectNetDepositFlow(thirtyDaysAgo);
        List<java.util.Map<String, Object>> netFlows = new java.util.ArrayList<>();
        if (netFlowsRaw != null) {
            for (java.util.Map<String, Object> map : netFlowsRaw) {
                java.util.Map<String, Object> flow = new java.util.HashMap<>();
                flow.put("currency", map.get("currency"));
                flow.put("netFlow", convertDouble(map.get("netflow")));
                netFlows.add(flow);
            }
        }
        perf.put("netDepositFlow30d", netFlows);

        // 4. 거래 회전율 (자산 총액 대비 30일 거래량)
        double totalBalanceKrw = 0;
        List<java.util.Map<String, Object>> balances = statsMapper.selectTotalBalances();
        if (balances != null) {
            for (java.util.Map<String, Object> map : balances) {
                String curr = (String) map.get("currency");
                double bal = convertDouble(map.get("totalbalance"));
                double rate = 1.0;
                if ("USD".equals(curr)) rate = 1350.0;
                else if ("BTC".equals(curr)) rate = 87750000.0;
                else if ("ADA".equals(curr)) rate = 500.0;
                else if ("JAF".equals(curr)) rate = 1000.0;
                totalBalanceKrw += (bal * rate);
            }
        }

        List<java.util.Map<String, Object>> vol30dList = statsMapper.selectVolume30d();
        double totalVolume30dKrw = 0.0;
        if (vol30dList != null) {
            for (java.util.Map<String, Object> map : vol30dList) {
                String qCurrency = (String) map.get("quote_currency");
                double vol = convertDouble(map.get("volume"));
                double rate = 1.0;
                if ("USD".equals(qCurrency)) rate = 1350.0; // 하드코딩 환율(임시)
                totalVolume30dKrw += (vol * rate);
            }
        }
        double velocityPercent = totalBalanceKrw > 0 ? (totalVolume30dKrw * 100.0 / totalBalanceKrw) : 0.0;

        java.util.Map<String, Object> tradingVelocity = new java.util.HashMap<>();
        tradingVelocity.put("totalUserAssetsKrwEquivalent", totalBalanceKrw);
        tradingVelocity.put("totalVolume30dKrwEquivalent", totalVolume30dKrw);
        tradingVelocity.put("velocityPercent", Math.round(velocityPercent * 100.0) / 100.0);
        perf.put("tradingVelocity", tradingVelocity);

        // 5. 주문 체결률 (최근 30일 체결 효율성)
        java.util.Map<String, Object> fillRate = statsMapper.selectOrderFillRate(thirtyDaysAgo);
        long filledCount = fillRate != null ? convertLong(fillRate.get("filled")) : 0L;
        long cancelledCount = fillRate != null ? convertLong(fillRate.get("cancelled")) : 0L;
        long activeCount = fillRate != null ? convertLong(fillRate.get("active")) : 0L;

        long totalOrders = filledCount + cancelledCount + activeCount;
        double fillRatePercent = totalOrders > 0 ? (filledCount * 100.0 / totalOrders) : 0.0;

        java.util.Map<String, Object> orderEfficiency = new java.util.HashMap<>();
        orderEfficiency.put("filledCount", filledCount);
        orderEfficiency.put("cancelledCount", cancelledCount);
        orderEfficiency.put("activeCount", activeCount);
        orderEfficiency.put("fillRatePercent", Math.round(fillRatePercent * 100.0) / 100.0);
        perf.put("orderEfficiency", orderEfficiency);

        // 6. 경쟁사 벤치마크 (핵심 경쟁 거래소 대비 모의 데이터 구성)
        java.util.List<java.util.Map<String, Object>> competitors = new java.util.ArrayList<>();
        competitors.add(java.util.Map.of(
                "exchange", "HFX (우리 거래소)",
                "btcUsdFeeRatePercent", AdminSettings.getFeeRate("BTC-USD") * 100.0,
                "adaKrwFeeRatePercent", AdminSettings.getFeeRate("ADA-KRW") * 100.0,
                "avgLatencyMs", 0.05,
                "tps", 100000,
                "uptimePercent", 99.999
        ));
        competitors.add(java.util.Map.of(
                "exchange", "Binance",
                "btcUsdFeeRatePercent", 0.1,
                "adaKrwFeeRatePercent", 0.1,
                "avgLatencyMs", 0.15,
                "tps", 1400000,
                "uptimePercent", 99.99
        ));
        competitors.add(java.util.Map.of(
                "exchange", "Upbit",
                "btcUsdFeeRatePercent", 0.05,
                "adaKrwFeeRatePercent", 0.05,
                "avgLatencyMs", 0.20,
                "tps", 50000,
                "uptimePercent", 99.95
        ));
        competitors.add(java.util.Map.of(
                "exchange", "Coinbase",
                "btcUsdFeeRatePercent", 0.60,
                "adaKrwFeeRatePercent", 0.60,
                "avgLatencyMs", 0.18,
                "tps", 30000,
                "uptimePercent", 99.99
        ));
        perf.put("competitors", competitors);

        return perf;
    }

    private double convertDouble(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return 0.0;
    }
    
    private long convertLong(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return 0L;
    }
}
