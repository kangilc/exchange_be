package exchange.engine.core;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import exchange.engine.book.OrderBook;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 프로메테우스 메트릭 수집 및 오더북(호가창) 스냅샷 조회를 제공하기 위한 내장 초경량 HTTP 서버 클래스입니다.
 * 싱글톤 패턴으로 구현되었습니다.
 */
public final class MetricsServer {
    private static final MetricsServer INSTANCE = new MetricsServer();

    // 처리된 총 주문 수
    private final AtomicLong totalOrders = new AtomicLong(0);
    // 매칭 지연시간(Us)의 누적 합산값
    private final AtomicLong matchLatencySumUs = new AtomicLong(0);
    // 총 매칭 체결 수
    private final AtomicLong matchCount = new AtomicLong(0);
    // 실시간 초당 트랜잭션 처리량 (TPS)
    private final AtomicLong currentTps = new AtomicLong(0);

    public static MetricsServer getInstance() {
        return INSTANCE;
    }

    private MetricsServer() {
    }

    /**
     * 총 주문 수 카운터를 증가시킵니다.
     */
    public void incrementOrders() {
        totalOrders.incrementAndGet();
    }

    /**
     * 매칭 체결이 발생했을 때의 지연시간을 기록하고 매칭 수를 갱신합니다.
     * 
     * @param latencyUs 마이크로초 단위 지연 시간
     */
    public void recordMatch(long latencyUs) {
        matchLatencySumUs.addAndGet(latencyUs);
        matchCount.incrementAndGet();
    }

    /**
     * 현재의 TPS를 직접 업데이트합니다.
     */
    public void updateTps(long tps) {
        currentTps.set(tps);
    }

    /**
     * 메트릭 서버를 지정된 포트로 구동하고, 백그라운드 TPS 추적기 스레드를 시작합니다.
     * 
     * @param engine 오더북 조회를 위한 매칭 엔진 참조 인스턴스
     */
    public void start(MatchingEngine engine) {
        boolean enabled = Boolean.parseBoolean(ConfigLoader.get("METRICS_ENABLED", "false"));
        if (!enabled) {
            System.out.println("Metrics server is disabled (METRICS_ENABLED=false). Skipping HTTP server creation.");
            return;
        }

        int port = ConfigLoader.getInt("METRICS_PORT", 9100);
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/metrics", new MetricsHandler());
            server.createContext("/snapshot", new SnapshotHandler(engine));
            server.setExecutor(null); // 기본 단일 스레드 Executor 사용
            server.start();
            System.out.println("Lightweight HTTP Metrics & Snapshot Server started on port " + port);

            // 1초마다 총 주문 접수 수량 변화량을 감지하여 실시간 TPS를 계산하는 백그라운드 데몬 스레드 구동
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

    /**
     * 프로메테우스(Prometheus) 형식의 포맷으로 누적 지표 데이터를 서빙하는 HttpHandler 구현체입니다.
     */
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

    /**
     * 오더북(호가창)의 실시간 매수/매도 잔량 정보를 JSON 포맷으로 서빙하는 HttpHandler 구현체입니다.
     */
    private class SnapshotHandler implements HttpHandler {
        private final MatchingEngine engine;

        public SnapshotHandler(MatchingEngine engine) {
            this.engine = engine;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            // 외부 프론트엔드 서비스의 통신 허용을 위한 CORS 설정 추가
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            OrderBook book = engine.getOrderBook();
            long seq = engine.getSeq();

            StringBuilder sb = new StringBuilder();
            sb.append("{");
            sb.append("\"symbol\":\"").append(ConfigLoader.get("SYMBOL", "BTC-USD")).append("\",");
            sb.append("\"seq\":").append(seq).append(",");

            // 1. 매수 잔량 그룹화 및 직렬화 (가격대별 잔량 합산)
            sb.append("\"bids\":[");
            boolean firstBid = true;
            synchronized (book.bids) {
                for (var entry : book.bids.entrySet()) {
                    long price = entry.getKey();
                    long qtySum = 0;
                    for (var order : entry.getValue()) {
                        qtySum += order.qty;
                    }
                    if (qtySum > 0) {
                        if (!firstBid)
                            sb.append(",");
                        sb.append("[").append(price).append(",").append(qtySum).append("]");
                        firstBid = false;
                    }
                }
            }
            sb.append("],");

            // 2. 매도 잔량 그룹화 및 직렬화 (가격대별 잔량 합산)
            sb.append("\"asks\":[");
            boolean firstAsk = true;
            synchronized (book.asks) {
                for (var entry : book.asks.entrySet()) {
                    long price = entry.getKey();
                    long qtySum = 0;
                    for (var order : entry.getValue()) {
                        qtySum += order.qty;
                    }
                    if (qtySum > 0) {
                        if (!firstAsk)
                            sb.append(",");
                        sb.append("[").append(price).append(",").append(qtySum).append("]");
                        firstAsk = false;
                    }
                }
            }
            sb.append("]");
            sb.append("}");

            byte[] response = sb.toString().getBytes("UTF-8");
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        }
    }
}
