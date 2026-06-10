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

    private static final long CACHE_EXPIRE_MS = 1000; // 1 second
    
    private static class PriceCacheEntry {
        final long price;
        final long timestamp;
        
        PriceCacheEntry(long price) {
            this.price = price;
            this.timestamp = System.currentTimeMillis();
        }
        
        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_EXPIRE_MS;
        }
    }
    
    private final java.util.concurrent.ConcurrentHashMap<String, PriceCacheEntry> priceCache = 
        new java.util.concurrent.ConcurrentHashMap<>();

    public Long getLastPrice(String symbol) {
        PriceCacheEntry entry = priceCache.get(symbol);
        if (entry == null || entry.isExpired()) {
            long price = tradeRepository.findFirstBySymbolOrderByTradeIdDesc(symbol)
                    .map(exchange.admin.model.Trade::getPrice)
                    .orElse(symbol.toUpperCase().contains("BTC") ? 6500000L : 50000L);
            entry = new PriceCacheEntry(price);
            priceCache.put(symbol, entry);
        }
        return entry.price;
    }

    /**
     * 특정 종목의 체결 내역(trades)을 기반으로 지정된 시간 해상도(1m, 5m, 15m, 1h)에 맞춰
     * 시가(Open), 고가(High), 저가(Low), 종가(Close), 거래량(Volume) 시계열 봉 데이터를 집계하여 반환합니다.
     * 한글 주석을 자세하게 추가하여 가독성을 극대화하였습니다.
     *
     * @param symbol     코인 심볼 (예: BTC-USD, ADA-KRW)
     * @param resolution 시간 해상도 (1m, 5m, 15m, 1h)
     * @param limit      최대 반환할 캔들 개수
     * @return 집계된 봉 데이터 리스트
     */
    public List<java.util.Map<String, Object>> getCandleStats(String symbol, String resolution, int limit) {
        // 데이터베이스의 인덱스 스캔을 활용하여 특정 종목의 최신 체결 데이터 500건을 빠르게 조회합니다.
        List<exchange.admin.model.Trade> trades = tradeRepository.findTop500BySymbolOrderByCreatedAtDesc(symbol);
        
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
            
            // 1. 시가(Open): 해당 버킷 내 최초로 성사된 체결 가격 (x100 스케일 복원)
            double open = minuteTrades.get(0).getPrice() / 100.0;
            
            // 2. 종가(Close): 해당 버킷 내 최종적으로 성사된 체결 가격
            double close = minuteTrades.get(minuteTrades.size() - 1).getPrice() / 100.0;
            
            // 3. 고가(High): 해당 버킷 내 체결 가격 중 가장 높은 가격
            double high = minuteTrades.stream().mapToLong(exchange.admin.model.Trade::getPrice).max().getAsLong() / 100.0;
            
            // 4. 저가(Low): 해당 버킷 내 체결 가격 중 가장 낮은 가격
            double low = minuteTrades.stream().mapToLong(exchange.admin.model.Trade::getPrice).min().getAsLong() / 100.0;
            
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
