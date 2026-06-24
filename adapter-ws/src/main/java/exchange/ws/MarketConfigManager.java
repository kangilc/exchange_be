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

public final class MarketConfigManager {
    private static final MarketConfigManager INSTANCE = new MarketConfigManager();

    private final ConcurrentHashMap<String, BigDecimal> minAmtCache = new ConcurrentHashMap<>();
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String adminApiUrl;
    private final ScheduledExecutorService scheduler;

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

    private void refreshConfig() {
        try {
            String url = adminApiUrl + "/admin/stats/markets";
            System.out.println("[MarketConfigManager] Fetching market configs from: " + url);
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(response.body());
                if (root.isArray()) {
                    for (JsonNode node : root) {
                        String symbol = node.has("symbol") ? node.get("symbol").asText() : null;
                        if (symbol != null) {
                            // Extract minAmt
                            double minAmtVal = node.has("minAmt") ? node.get("minAmt").asDouble() : 0.0;
                            BigDecimal minAmt = BigDecimal.valueOf(minAmtVal);
                            minAmtCache.put(symbol, minAmt);
                            System.out.println("[MarketConfigManager] Loaded symbol: " + symbol + ", minAmt: " + minAmt);
                        }
                    }
                }
            } else {
                System.err.println("[MarketConfigManager] Failed to fetch market configs. Status: " + response.statusCode());
            }
        } catch (Exception e) {
            System.err.println("[MarketConfigManager] Error refreshing market configurations: " + e.getMessage());
        }
    }
}
