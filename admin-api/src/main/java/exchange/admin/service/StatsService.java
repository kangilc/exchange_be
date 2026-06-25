package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.TradeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 거래소 통계 및 실시간 지표 분석 서비스.
 * 회원 수, 거래 횟수, 누적 거래 대금, 지갑 정보 및 캔들(봉) 데이터 집계 기능을 담당하며,
 * 어드민 대시보드 성능 지표(수수료 수익, DAU/MAU, 원장 입출금 흐름 등) 산출을 지원합니다.
 */
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

    @Autowired
    private exchange.admin.repository.MarketRepository marketRepository;

    /**
     * 지정된 해상도(resolution) 단위로 그룹핑된 거래 통계 목록을 조회합니다.
     * @param resolution 시간 해상도 (예: daily, weekly 등)
     * @return 거래 통계 목록
     */
    public List<TradeRepository.TradeStatsProjection> getTradeStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return tradeRepository.getTradeStats(timeBucket);
    }

    /**
     * 지정된 해상도 단위로 그룹핑된 원장 변경 통계 목록을 조회합니다.
     * @param resolution 시간 해상도
     * @return 원장 변경 통계 목록
     */
    public List<LedgerJournalRepository.LedgerStatsProjection> getLedgerStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return ledgerJournalRepository.getLedgerStats(timeBucket);
    }

    /**
     * 지정된 해상도 단위로 그룹핑된 신규 회원 가입 통계 목록을 조회합니다.
     * @param resolution 시간 해상도
     * @return 가입 통계 목록
     */
    public List<exchange.admin.repository.UserRepository.UserStatsProjection> getUserStats(String resolution) {
        String timeBucket = mapResolutionToBucket(resolution);
        return userRepository.getUserStats(timeBucket);
    }

    /**
     * 거래소 전반의 요약 통계(총 회원수, 누적 체결 수, 누적 거래 대금 등)를 집계합니다.
     * @return 요약 통계 맵
     */
    public java.util.Map<String, Object> getSummaryStats() {
        java.util.Map<String, Object> summary = new java.util.HashMap<>();
        summary.put("totalUsers", userRepository.count());
        summary.put("totalTrades", tradeRepository.getTotalTradeCount());
        summary.put("totalVolume", tradeRepository.getTotalTradeVolume());
        summary.put("totalWallets", walletRepository.count());
        return summary;
    }

    /**
     * 특정 마켓 종목의 최종 체결 가격을 조회합니다. 캐시를 적용하여 조회 부하를 완화하며, 체결 내역이 없는 경우 상장가를 반환합니다.
     * @param symbol 마켓 심볼 (예: BTC-USD)
     * @return 최종 체결 가격 (정수형)
     */
    @org.springframework.cache.annotation.Cacheable(value = "lastPrice", key = "#symbol")
    public Long getLastPrice(String symbol) {
        return tradeRepository.findFirstBySymbolOrderByTradeIdDesc(symbol)
                .map(exchange.admin.model.Trade::getPrice)
                .orElseGet(() -> marketRepository.findById(symbol)
                        .map(exchange.admin.model.Market::getListingPrice)
                        .orElse(0L));
    }

    /**
     * 특정 마켓 종목의 전일 종가(기준가)를 조회합니다. 오전 9시 정각 기준으로 구분값을 계산합니다.
     * @param symbol 마켓 심볼 (예: BTC-USD)
     * @return 전일 종가 (정수형)
     */
    public Long getPrevClosePrice(String symbol) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        java.time.LocalDateTime cutoff = now.withHour(9).withMinute(0).withSecond(0).withNano(0);
        if (now.isBefore(cutoff)) {
            cutoff = cutoff.minusDays(1);
        }

        // 1. Cutoff 시점 이전의 마지막 거래
        java.util.Optional<exchange.admin.model.Trade> latestTrade = tradeRepository.findLatestTradeBeforeCutoff(symbol,
                cutoff);
        if (latestTrade.isPresent()) {
            return latestTrade.get().getPrice();
        }

        // 2. 없으면 전체 거래 중 최초 거래
        java.util.Optional<exchange.admin.model.Trade> firstTrade = tradeRepository.findFirstTrade(symbol);
        if (firstTrade.isPresent()) {
            return firstTrade.get().getPrice();
        }

        // 3. 그것도 없으면 DB markets 테이블의 listing_price 설정
        return marketRepository.findById(symbol)
                .map(exchange.admin.model.Market::getListingPrice)
                .orElse(0L);
    }

    /**
     * 특정 종목의 체결 내역(trades)을 기반으로 지정된 시간 해상도(1m, 5m, 15m, 1h)에 맞춰
     * 시가(Open), 고가(High), 저가(Low), 종가(Close), 거래량(Volume) 시계열 봉 데이터를 집계하여 반환합니다.
     *
     * @param symbol     코인 심볼 (예: BTC-USD, ADA-KRW)
     * @param resolution 시간 해상도 (1m, 5m, 15m, 1h)
     * @param limit      최대 반환할 캔들 개수
     * @return 집계된 봉 데이터 리스트
     */
    public List<java.util.Map<String, Object>> getCandleStats(String symbol, String resolution, int limit) {
        // 해상도에 맞게 필요한 조회 건수를 유연하게 결정합니다. (주봉, 월봉, 연봉은 50,000건, 나머지는 500건)
        List<exchange.admin.model.Trade> trades;
        if (resolution != null && (resolution.equalsIgnoreCase("1w") || resolution.equalsIgnoreCase("1mo")
                || resolution.equalsIgnoreCase("1y"))) {
            trades = tradeRepository.findTop50000BySymbolOrderByCreatedAtDesc(symbol);
        } else {
            trades = tradeRepository.findTop500BySymbolOrderByCreatedAtDesc(symbol);
        }

        // 해상도 문자열을 초(seconds) 단위의 집계 분모값으로 파싱하여 변환합니다.
        long bucketSizeSeconds = 60; // 기본값은 1분 (60초)
        if (resolution != null) {
            switch (resolution.toLowerCase()) {
                case "5m":
                    bucketSizeSeconds = 300; // 5분 = 300초
                    break;
                case "15m":
                    bucketSizeSeconds = 900; // 15분 = 900초
                    break;
                case "1h":
                    bucketSizeSeconds = 3600; // 1시간 = 3600초
                    break;
                case "1w":
                    bucketSizeSeconds = 604800; // 1주 = 7일 = 604800초
                    break;
                case "1mo":
                    bucketSizeSeconds = 2592000; // 1월 = 30일 = 2592000초
                    break;
                case "1y":
                    bucketSizeSeconds = 31536000; // 1년 = 365일 = 31536000초
                    break;
                case "1m":
                default:
                    bucketSizeSeconds = 60; // 기본 1분
                    break;
            }
        }

        // 지정된 시간 해상도(초 단위)로 그룹핑을 수행하기 위해 TreeMap을 사용합니다.
        // TreeMap을 사용하면 시간축 기준 오름차순(과거 -> 현재) 정렬이 자동으로 유지됩니다.
        java.util.Map<Long, List<exchange.admin.model.Trade>> grouped = new java.util.TreeMap<>();

        // 시스템의 기본 타임존 정보를 가져와 타임스탬프 계산에 정밀하게 대조합니다.
        java.time.ZoneId zoneId = java.time.ZoneId.systemDefault();
        for (exchange.admin.model.Trade trade : trades) {
            // 체결 로컬 시간을 UNIX Epoch 초(seconds) 단위로 변환합니다.
            long epochSeconds = trade.getExecutedAt().atZone(zoneId).toEpochSecond();

            // 해상도 버킷 크기(예: 300초)로 나눈 후 다시 곱해 정수 내림 연산으로 시간 경계선을 도출합니다.
            long bucketTime = (epochSeconds / bucketSizeSeconds) * bucketSizeSeconds;

            // 동일 시간대 버킷 리스트에 체결 데이터를 차곡차곡 축적합니다.
            grouped.computeIfAbsent(bucketTime, k -> new java.util.ArrayList<>()).add(trade);
        }

        // 그룹핑된 시간별 체결 뭉치들을 하나씩 가공하여 금융 캔들(OHLCV) 규격으로 직렬화합니다.
        List<java.util.Map<String, Object>> candles = new java.util.ArrayList<>();
        for (java.util.Map.Entry<Long, List<exchange.admin.model.Trade>> entry : grouped.entrySet()) {
            long time = entry.getKey();
            List<exchange.admin.model.Trade> minuteTrades = entry.getValue();

            // 시가(Open)와 종가(Close)를 정확하게 판단하기 위해 체결 고유 번호(tradeId) 기준 오름차순 정렬합니다.
            minuteTrades.sort(java.util.Comparator.comparingLong(exchange.admin.model.Trade::getTradeId));

            // 1. 시가(Open): 해당 버킷 내 최초로 성사된 체결 가격 (동적 스케일 복원)
            Integer decimals = marketRepository.findById(symbol)
                    .map(exchange.admin.model.Market::getPriceDecimals)
                    .orElse(2);
            double divisor = Math.pow(10, decimals);
            double open = minuteTrades.get(0).getPrice() / divisor;

            // 2. 종가(Close): 해당 버킷 내 최종적으로 성사된 체결 가격
            double close = minuteTrades.get(minuteTrades.size() - 1).getPrice() / divisor;

            // 3. 고가(High): 해당 버킷 내 체결 가격 중 가장 높은 가격
            double high = minuteTrades.stream().mapToLong(exchange.admin.model.Trade::getPrice).max().getAsLong()
                    / divisor;

            // 4. 저가(Low): 해당 버킷 내 체결 가격 중 가장 낮은 가격
            double low = minuteTrades.stream().mapToLong(exchange.admin.model.Trade::getPrice).min().getAsLong()
                    / divisor;

            // 5. 거래량(Volume): 해당 버킷 내에서 매칭되어 거래된 코인 총합 수량
            long volume = minuteTrades.stream().mapToLong(exchange.admin.model.Trade::getQty).sum();

            // 캔들 정보를 맵 구조체에 담아 리스트로 저장합니다.
            java.util.Map<String, Object> candle = new java.util.HashMap<>();
            candle.put("time", time);
            candle.put("open", open);
            candle.put("high", high);
            candle.put("low", low);
            candle.put("close", close);
            candle.put("volume", volume);

            candles.add(candle);
        }

        // 사용자가 요청한 개수(limit) 제한값만큼 최신 순으로 슬라이싱하여 반환합니다.
        if (candles.size() > limit) {
            return candles.subList(candles.size() - limit, candles.size());
        }
        return candles;
    }

    @Autowired
    private javax.sql.DataSource dataSource;

    /**
     * 어드민 대시보드에서 활용하는 거래소 핵심 성능 및 재무 지표를 집계하여 산출합니다.
     * (누적 수수료 수익, 24시간 수익, DAU/MAU 활성 유저 비율, 30일 자산 유입 흐름, 거래 회전율 및 경쟁사 벤치마크 데이터 등)
     * @return 집계된 성능 지표 Map
     */
    public java.util.Map<String, Object> getPerformanceStats() {
        java.util.Map<String, Object> perf = new java.util.HashMap<>();

        try (java.sql.Connection conn = dataSource.getConnection()) {
            // 1. Fee Revenue (Cumulative & 24H)
            double btcVolumeTotal = 0;
            double adaVolumeTotal = 0;
            double btcFeesTotal = 0;
            double adaFeesTotal = 0;

            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT " +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'BTC-USD' THEN t.price / POWER(10, COALESCE(m.price_decimals, 2)) * t.qty ELSE 0 END), 0.0) as btcVol, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'ADA-KRW' THEN t.price / POWER(10, COALESCE(m.price_decimals, 2)) * t.qty ELSE 0 END), 0.0) as adaVol, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'BTC-USD' THEN t.fee_amount ELSE 0 END), 0.0) as btcFees, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'ADA-KRW' THEN t.fee_amount ELSE 0 END), 0.0) as adaFees "
                                    +
                                    "FROM trades t LEFT JOIN markets m ON t.symbol = m.symbol")) {
                if (rs.next()) {
                    btcVolumeTotal = rs.getDouble("btcVol");
                    adaVolumeTotal = rs.getDouble("adaVol");
                    btcFeesTotal = rs.getDouble("btcFees");
                    adaFeesTotal = rs.getDouble("adaFees");
                }
            }

            double btcVolume24h = 0;
            double adaVolume24h = 0;
            double btcFees24h = 0;
            double adaFees24h = 0;
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT " +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'BTC-USD' THEN t.price / POWER(10, COALESCE(m.price_decimals, 2)) * t.qty ELSE 0 END), 0.0) as btcVol, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'ADA-KRW' THEN t.price / POWER(10, COALESCE(m.price_decimals, 2)) * t.qty ELSE 0 END), 0.0) as adaVol, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'BTC-USD' THEN t.fee_amount ELSE 0 END), 0.0) as btcFees, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'ADA-KRW' THEN t.fee_amount ELSE 0 END), 0.0) as adaFees "
                                    +
                                    "FROM trades t LEFT JOIN markets m ON t.symbol = m.symbol WHERE t.created_at >= NOW() - INTERVAL '1 day'")) {
                if (rs.next()) {
                    btcVolume24h = rs.getDouble("btcVol");
                    adaVolume24h = rs.getDouble("adaVol");
                    btcFees24h = rs.getDouble("btcFees");
                    adaFees24h = rs.getDouble("adaFees");
                }
            }

            java.util.Map<String, Object> feeRevenue = new java.util.HashMap<>();
            feeRevenue.put("btcUsdVolumeUsd", btcVolumeTotal);
            feeRevenue.put("btcUsdFeesUsd", btcFeesTotal);
            feeRevenue.put("adaKrwVolumeKrw", adaVolumeTotal);
            feeRevenue.put("adaKrwFeesKrw", adaFeesTotal);
            feeRevenue.put("btcUsdVolume24hUsd", btcVolume24h);
            feeRevenue.put("btcUsdFees24hUsd", btcFees24h);
            feeRevenue.put("adaKrwVolume24hKrw", adaVolume24h);
            feeRevenue.put("adaKrwFees24hKrw", adaFees24h);
            feeRevenue.put("btcUsdCurrentFeeRate", AdminSettings.getFeeRate("BTC-USD"));
            feeRevenue.put("adaKrwCurrentFeeRate", AdminSettings.getFeeRate("ADA-KRW"));
            perf.put("feeRevenue", feeRevenue);

            // 2. Active Users (일간 활성 사용자 DAU 24H / 월간 활성 사용자 MAU 30D 비율 계산)
            long dau24h = 0;
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT COUNT(DISTINCT user_id) FROM (" +
                                    "SELECT user_id FROM orders WHERE created_at >= NOW() - INTERVAL '1 day' " +
                                    "UNION " +
                                    "SELECT user_id FROM ledger_journal WHERE created_at >= NOW() - INTERVAL '1 day'" +
                                    ") as active_users")) {
                if (rs.next()) {
                    dau24h = rs.getLong(1);
                }
            }

            long mau30d = 0;
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT COUNT(DISTINCT user_id) FROM (" +
                                    "SELECT user_id FROM orders WHERE created_at >= NOW() - INTERVAL '30 days' " +
                                    "UNION " +
                                    "SELECT user_id FROM ledger_journal WHERE created_at >= NOW() - INTERVAL '30 days'"
                                    +
                                    ") as active_users")) {
                if (rs.next()) {
                    mau30d = rs.getLong(1);
                }
            }

            java.util.Map<String, Object> activeUsers = new java.util.HashMap<>();
            activeUsers.put("dau24h", dau24h);
            activeUsers.put("mau30d", mau30d);
            double dauMauRatio = mau30d > 0 ? (dau24h * 100.0 / mau30d) : 0.0;
            activeUsers.put("dauMauRatioPercent", Math.round(dauMauRatio * 100.0) / 100.0);
            perf.put("activeUsers", activeUsers);

            // 3. Net Deposit Flow (최근 30일 동안의 자산별 순 입출금 누적 흐름 산출)
            java.util.List<java.util.Map<String, Object>> netFlows = new java.util.ArrayList<>();
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT currency, " +
                                    "COALESCE(SUM(amount), 0.0) as netFlow " +
                                    "FROM ledger_journal " +
                                    "WHERE type IN ('DEPOSIT', 'WITHDRAWAL') " +
                                    "AND created_at >= NOW() - INTERVAL '30 days' " +
                                    "GROUP BY currency")) {
                while (rs.next()) {
                    java.util.Map<String, Object> flow = new java.util.HashMap<>();
                    flow.put("currency", rs.getString("currency"));
                    flow.put("netFlow", rs.getDouble("netFlow"));
                    netFlows.add(flow);
                }
            }
            perf.put("netDepositFlow30d", netFlows);

            // 4. Trading Velocity (자산 총액 대비 최근 30일 간 거래 회전율 분석)
            double totalBalanceKrw = 0;
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT currency, SUM(balance + locked_balance) as totalBalance FROM wallets GROUP BY currency")) {
                while (rs.next()) {
                    String curr = rs.getString("currency");
                    double bal = rs.getDouble("totalBalance");

                    double rate = 1.0; // default for KRW
                    if ("USD".equals(curr))
                        rate = 1350.0;
                    else if ("BTC".equals(curr))
                        rate = 87750000.0;
                    else if ("ADA".equals(curr))
                        rate = 500.0;
                    else if ("JAF".equals(curr))
                        rate = 1000.0;

                    totalBalanceKrw += (bal * rate);
                }
            }

            double volume30dBtcUsd = 0;
            double volume30dAdaKrw = 0;
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT " +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'BTC-USD' THEN t.price / POWER(10, COALESCE(m.price_decimals, 2)) * t.qty ELSE 0 END), 0.0) as btcVol, "
                                    +
                                    "COALESCE(SUM(CASE WHEN t.symbol = 'ADA-KRW' THEN t.price / POWER(10, COALESCE(m.price_decimals, 2)) * t.qty ELSE 0 END), 0.0) as adaVol "
                                    +
                                    "FROM trades t LEFT JOIN markets m ON t.symbol = m.symbol WHERE t.created_at >= NOW() - INTERVAL '30 days'")) {
                if (rs.next()) {
                    volume30dBtcUsd = rs.getDouble("btcVol");
                    volume30dAdaKrw = rs.getDouble("adaVol");
                }
            }
            double totalVolume30dKrw = (volume30dBtcUsd * 1350.0) + volume30dAdaKrw;
            double velocityPercent = totalBalanceKrw > 0 ? (totalVolume30dKrw * 100.0 / totalBalanceKrw) : 0.0;

            java.util.Map<String, Object> tradingVelocity = new java.util.HashMap<>();
            tradingVelocity.put("totalUserAssetsKrwEquivalent", totalBalanceKrw);
            tradingVelocity.put("totalVolume30dKrwEquivalent", totalVolume30dKrw);
            tradingVelocity.put("velocityPercent", Math.round(velocityPercent * 100.0) / 100.0);
            perf.put("tradingVelocity", tradingVelocity);

            // 5. Order Fill Rate (30일 주문 체결 및 취소 건수 분석을 통한 체결 효율성 도출)
            long filledCount = 0;
            long cancelledCount = 0;
            long activeCount = 0;
            try (java.sql.Statement stmt = conn.createStatement();
                    java.sql.ResultSet rs = stmt.executeQuery(
                            "SELECT " +
                                    "COALESCE(SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END), 0) as filled, " +
                                    "COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) as cancelled, "
                                    +
                                    "COALESCE(SUM(CASE WHEN status IN ('NEW', 'PARTIALLY_FILLED') THEN 1 ELSE 0 END), 0) as active "
                                    +
                                    "FROM orders WHERE created_at >= NOW() - INTERVAL '30 days'")) {
                if (rs.next()) {
                    filledCount = rs.getLong("filled");
                    cancelledCount = rs.getLong("cancelled");
                    activeCount = rs.getLong("active");
                }
            }
            double totalFilledOrCancelled = filledCount + cancelledCount;
            double fillRatePercent = totalFilledOrCancelled > 0 ? (filledCount * 100.0 / totalFilledOrCancelled) : 0.0;

            java.util.Map<String, Object> orderEfficiency = new java.util.HashMap<>();
            orderEfficiency.put("filledCount", filledCount);
            orderEfficiency.put("cancelledCount", cancelledCount);
            orderEfficiency.put("activeCount", activeCount);
            orderEfficiency.put("fillRatePercent", Math.round(fillRatePercent * 100.0) / 100.0);
            perf.put("orderEfficiency", orderEfficiency);

            // 6. Competitor Benchmark (핵심 경쟁 거래소 대비 수수료율 및 성능 데이터 벤치마크 모의 데이터 구성)
            java.util.List<java.util.Map<String, Object>> competitors = new java.util.ArrayList<>();

            competitors.add(java.util.Map.of(
                    "exchange", "HFX (우리 거래소)",
                    "btcUsdFeeRatePercent", AdminSettings.getFeeRate("BTC-USD") * 100.0,
                    "adaKrwFeeRatePercent", AdminSettings.getFeeRate("ADA-KRW") * 100.0,
                    "avgLatencyMs", 0.05,
                    "tps", 100000,
                    "reliabilityPercent", 99.99));
            competitors.add(java.util.Map.of(
                    "exchange", "Binance (바이낸스)",
                    "btcUsdFeeRatePercent", 0.10,
                    "adaKrwFeeRatePercent", 0.10,
                    "avgLatencyMs", 3.50,
                    "tps", 50000,
                    "reliabilityPercent", 99.95));
            competitors.add(java.util.Map.of(
                    "exchange", "Upbit (업비트)",
                    "btcUsdFeeRatePercent", 0.05,
                    "adaKrwFeeRatePercent", 0.05,
                    "avgLatencyMs", 5.00,
                    "tps", 20000,
                    "reliabilityPercent", 99.90));
            competitors.add(java.util.Map.of(
                    "exchange", "Coinbase (코인베이스)",
                    "btcUsdFeeRatePercent", 0.40,
                    "adaKrwFeeRatePercent", 0.40,
                    "avgLatencyMs", 15.00,
                    "tps", 10000,
                    "reliabilityPercent", 99.99));
            perf.put("competitors", competitors);

        } catch (java.sql.SQLException e) {
            org.slf4j.LoggerFactory.getLogger(StatsService.class)
                    .error("Failed to fetch performance stats", e);
        }

        return perf;
    }

    /**
     * 현재 개설된 활성 마켓 종목 목록에 대해 각 종목별 현재가 및 전일 종가 정보가 매핑된 티커 리스트를 제공합니다.
     * @return 티커 맵 목록
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
     * 입력된 해상도 문자열을 PostgreSQL 시계열 date_trunc 함수의 인자 규격에 맞게 변환/정규화합니다.
     * @param resolution 프론트엔드 입력 해상도
     * @return DB 질의용 시간 버킷 문자열 (day, week, month 등)
     */
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
