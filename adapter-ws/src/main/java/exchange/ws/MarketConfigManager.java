package exchange.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 시장 설정 관리자.
 * DB 접근을 최소화하기 위해 어드민 API를 주기적으로 폴링하여 최소 주문 수량 및 가격 소수점 자릿수를 캐싱한다.
 */
public final class MarketConfigManager {
    private static final Logger log = LoggerFactory.getLogger(MarketConfigManager.class);
    private static final MarketConfigManager INSTANCE = new MarketConfigManager();

    private final ConcurrentHashMap<String, BigDecimal> minAmtCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Integer> decimalsCache = new ConcurrentHashMap<>();
    // 호가 단위 구간별 설정 캐시
    private final ConcurrentHashMap<String, java.util.List<TickSizeLevel>> tickSizeLevelsCache = new ConcurrentHashMap<>();
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String adminApiUrl;
    private final ScheduledExecutorService scheduler;

    // 호가 단위 구간 클래스
    public static class TickSizeLevel {
        private final BigDecimal priceAbove; // 해당 금액 이상일 때 적용
        private final BigDecimal tickSize;   // 적용할 호가 단위

        public TickSizeLevel(BigDecimal priceAbove, BigDecimal tickSize) {
            this.priceAbove = priceAbove;
            this.tickSize = tickSize;
        }

        public BigDecimal getPriceAbove() { return priceAbove; }
        public BigDecimal getTickSize() { return tickSize; }
    }

    private MarketConfigManager() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = new ObjectMapper();
        this.adminApiUrl = ConfigLoader.get("ADMIN_API_URL", "http://localhost:8181");
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "market-config-refresher");
            t.setDaemon(true);
            return t;
        });
    }

    public static MarketConfigManager getInstance() {
        return INSTANCE;
    }

    public void start() {
        // Fetch immediately on startup
        refreshConfig();
        // Schedule every 60 seconds
        scheduler.scheduleAtFixedRate(this::refreshConfig, 60, 60, TimeUnit.SECONDS);
    }

    public void stop() {
        scheduler.shutdown();
    }

    public BigDecimal getMinAmt(String symbol) {
        // Default fallback if not loaded yet
        return minAmtCache.getOrDefault(symbol, BigDecimal.ZERO);
    }

    public int getDecimals(String symbol) {
        return decimalsCache.getOrDefault(symbol, 2);
    }

    // 특정 가격에 해당하는 호가 단위를 조회함
    public BigDecimal getTickSize(String symbol, BigDecimal humanPrice) {
        java.util.List<TickSizeLevel> levels = tickSizeLevelsCache.get(symbol);
        // 설정된 호가 단위 구간 정보가 없으면 소수점 자릿수 기준 기본 단위를 사용함
        if (levels == null || levels.isEmpty()) {
            int decimals = getDecimals(symbol);
            return BigDecimal.ONE.divide(BigDecimal.TEN.pow(decimals), decimals, java.math.RoundingMode.HALF_UP);
        }

        BigDecimal matchedTickSize = null;
        // 가격 이상 조건에 맞는 호가 단위를 순차적으로 탐색함
        for (TickSizeLevel level : levels) {
            if (humanPrice.compareTo(level.getPriceAbove()) >= 0) {
                matchedTickSize = level.getTickSize();
            } else {
                break;
            }
        }
        // 매칭된 호가 단위가 없으면 첫 번째 호가 단위를 기본으로 사용함
        if (matchedTickSize == null) {
            matchedTickSize = levels.get(0).getTickSize();
        }
        return matchedTickSize;
    }

    private void refreshConfig() {
        try {
            String url = adminApiUrl + "/admin/stats/markets";
            log.info("Fetching market configs from: {}", url);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                JsonNode dataNode = root.has("data") ? root.get("data") : root;
                JsonNode contentNode = dataNode.has("content") ? dataNode.get("content") : dataNode;

                if (contentNode.isArray()) {
                    for (JsonNode node : contentNode) {
                        String symbol = node.has("symbol") ? node.get("symbol").asText() : null;
                        if (symbol != null) {
                            // Extract minAmt & decimals
                            double minAmtVal = node.has("minAmt") ? node.get("minAmt").asDouble() : 0.0;
                            BigDecimal minAmt = BigDecimal.valueOf(minAmtVal);
                            minAmtCache.put(symbol, minAmt);
                            int decimals = node.has("priceDecimals") ? node.get("priceDecimals").asInt() : 2;
                            decimalsCache.put(symbol, decimals);

                            // 호가 단위 구간 정보를 파싱하여 캐시에 저장함
                            if (node.has("tickSizeLevels") && node.get("tickSizeLevels").isArray()) {
                                java.util.List<TickSizeLevel> levels = new java.util.ArrayList<>();
                                for (JsonNode lvlNode : node.get("tickSizeLevels")) {
                                    double priceAbove = lvlNode.has("priceAbove") ? lvlNode.get("priceAbove").asDouble() : 0.0;
                                    double tickSize = lvlNode.has("tickSize") ? lvlNode.get("tickSize").asDouble() : 0.01;
                                    levels.add(new TickSizeLevel(BigDecimal.valueOf(priceAbove), BigDecimal.valueOf(tickSize)));
                                }
                                tickSizeLevelsCache.put(symbol, levels);
                            }

                            log.info("Loaded symbol: {}, minAmt: {}, decimals: {}", symbol, minAmt, decimals);
                        }
                    }
                }
            } else {
                log.error("Failed to fetch market configs. Status: {}", response.statusCode());
            }
        } catch (Exception e) {
            log.error("Error refreshing market configurations: {}", e.getMessage());
        }
    }
}
