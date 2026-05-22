package exchange.engine.core;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicLong;

public final class MetricsServer {
    private static final MetricsServer INSTANCE = new MetricsServer();

    private final AtomicLong totalOrders = new AtomicLong(0);
    private final AtomicLong matchLatencySumUs = new AtomicLong(0);
    private final AtomicLong matchCount = new AtomicLong(0);
    private final AtomicLong currentTps = new AtomicLong(0);

    public static MetricsServer getInstance() {
        return INSTANCE;
    }

    private MetricsServer() {}

    public void incrementOrders() {
        totalOrders.incrementAndGet();
    }

    public void recordMatch(long latencyUs) {
        matchLatencySumUs.addAndGet(latencyUs);
        matchCount.incrementAndGet();
    }

    public void updateTps(long tps) {
        currentTps.set(tps);
    }

    public void start() {
        boolean enabled = Boolean.parseBoolean(ConfigLoader.get("METRICS_ENABLED", "false"));
        if (!enabled) {
            System.out.println("Metrics server is disabled (METRICS_ENABLED=false). Skipping HTTP server creation.");
            return;
        }

        int port = ConfigLoader.getInt("METRICS_PORT", 9100);
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/metrics", new MetricsHandler());
            server.setExecutor(null); // default executor
            server.start();
            System.out.println("Lightweight HTTP Metrics Server started on port " + port);

            // Start background TPS tracker thread
            Thread tpsUpdater = new Thread(() -> {
                long lastCount = 0;
                while (true) {
                    try {
                        Thread.sleep(1000);
                        long current = totalOrders.get();
                        long diff = current - lastCount;
                        currentTps.set(diff);
                        lastCount = current;
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }, "tps-updater");
            tpsUpdater.setDaemon(true);
            tpsUpdater.start();

        } catch (IOException e) {
            System.err.println("Failed to start Metrics Server on port " + port + ": " + e.getMessage());
        }
    }

    private class MetricsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            long total = totalOrders.get();
            long matches = matchCount.get();
            long latencySum = matchLatencySumUs.get();
            double avgLatency = matches == 0 ? 0.0 : (double) latencySum / matches;
            long tps = currentTps.get();

            StringBuilder sb = new StringBuilder();
            sb.append("# HELP matching_engine_total_orders Total orders ingested\n");
            sb.append("# TYPE matching_engine_total_orders counter\n");
            sb.append("matching_engine_total_orders ").append(total).append("\n");

            sb.append("# HELP matching_engine_match_count Total execution match count\n");
            sb.append("# TYPE matching_engine_match_count counter\n");
            sb.append("matching_engine_match_count ").append(matches).append("\n");

            sb.append("# HELP matching_engine_avg_latency_us Average matching latency in microseconds\n");
            sb.append("# TYPE matching_engine_avg_latency_us gauge\n");
            sb.append("matching_engine_avg_latency_us ").append(avgLatency).append("\n");

            sb.append("# HELP matching_engine_tps Current matches processed per second\n");
            sb.append("# TYPE matching_engine_tps gauge\n");
            sb.append("matching_engine_tps ").append(tps).append("\n");

            byte[] response = sb.toString().getBytes("UTF-8");
            exchange.getResponseHeaders().set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        }
    }
}
