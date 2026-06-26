package exchange.ws;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class WsMetricsServer {
    private static final Logger log = LoggerFactory.getLogger(WsMetricsServer.class);
    private static final WsMetricsServer INSTANCE = new WsMetricsServer();

    private final AtomicLong activeConnections = new AtomicLong(0);
    private final AtomicLong totalMessages = new AtomicLong(0);
    private final AtomicLong currentTps = new AtomicLong(0);

    public static WsMetricsServer getInstance() {
        return INSTANCE;
    }

    private WsMetricsServer() {}

    public void incrementConnections() {
        activeConnections.incrementAndGet();
    }

    public void decrementConnections() {
        long current = activeConnections.decrementAndGet();
        if (current < 0) activeConnections.set(0);
    }

    public void incrementMessages() {
        totalMessages.incrementAndGet();
    }

    public void start() {
        boolean enabled = Boolean.parseBoolean(ConfigLoader.get("METRICS_ENABLED", "false"));
        if (!enabled) {
            log.info("WS Metrics server is disabled (METRICS_ENABLED=false). Skipping HTTP server creation.");
            return;
        }

        int port = ConfigLoader.getInt("METRICS_PORT", 9102);
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/metrics", new MetricsHandler());
            server.setExecutor(null); // default executor
            server.start();
            log.info("Lightweight WS Gateway HTTP Metrics Server started on port {}", port);

            // Start background TPS tracker thread
            Thread tpsUpdater = new Thread(() -> {
                long lastCount = 0;
                while (true) {
                    try {
                        Thread.sleep(1000);
                        long current = totalMessages.get();
                        long diff = current - lastCount;
                        currentTps.set(diff);
                        lastCount = current;
                    } catch (InterruptedException e) {
                        break;
                    }
                }
            }, "ws-tps-updater");
            tpsUpdater.setDaemon(true);
            tpsUpdater.start();

        } catch (IOException e) {
            log.error("Failed to start WS Metrics Server on port {}: {}", port, e.getMessage());
        }
    }

    private class MetricsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            long conns = activeConnections.get();
            long total = totalMessages.get();
            long tps = currentTps.get();

            StringBuilder sb = new StringBuilder();
            sb.append("# HELP websocket_active_connections Current active WebSocket connections\n");
            sb.append("# TYPE websocket_active_connections gauge\n");
            sb.append("websocket_active_connections ").append(conns).append("\n");

            sb.append("# HELP websocket_total_messages_received Total binary and text messages processed\n");
            sb.append("# TYPE websocket_total_messages_received counter\n");
            sb.append("websocket_total_messages_received ").append(total).append("\n");

            sb.append("# HELP websocket_tps Messages broadcasted per second\n");
            sb.append("# TYPE websocket_tps gauge\n");
            sb.append("websocket_tps ").append(tps).append("\n");

            byte[] response = sb.toString().getBytes("UTF-8");
            exchange.getResponseHeaders().set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        }
    }
}
