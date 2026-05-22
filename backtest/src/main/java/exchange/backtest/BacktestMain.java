package exchange.backtest;

import exchange.engine.command.NewOrderCmd;
import exchange.engine.core.MatchingEngine;
import exchange.engine.domain.Order;
import exchange.engine.domain.Side;
import exchange.engine.event.EventOutbox;

import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;

public final class BacktestMain {
    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("  QUANTUM EXCHANGE - HIGH-SPEED OFFLINE BACKTESTER");
        System.out.println("==================================================");
        
        try {
            // 1. Load CSV data
            System.out.println("Loading orders.csv from resources...");
            List<Order> orders = CsvFeed.loadFromResource("/orders.csv");
            System.out.println("Loaded " + orders.size() + " orders successfully.");
            
            // 2. Setup metric tracking
            long[] eventCounts = new long[3]; // 0: delta, 1: trade, 2: cancel
            EventOutbox outbox = new EventOutbox() {
                @Override
                public void delta(String symbol, long seq, Side side, long price, long deltaQty) {
                    eventCounts[0]++;
                }

                @Override
                public void trade(String symbol, long seq, Order taker, Order maker, long qty) {
                    eventCounts[1]++;
                }

                @Override
                public void cancel(String symbol, long seq, Order order) {
                    eventCounts[2]++;
                }
            };
            
            // 3. JVM Warmup (Run engine once with loaded orders to trigger JIT compiler optimization)
            System.out.print("Warming up JVM JIT compiler... ");
            MatchingEngine warmupEngine = new MatchingEngine("BTC-USD", new ArrayBlockingQueue<>(1), outbox);
            for (Order o : orders) {
                Order cloned = new Order(o.orderId, o.side, o.price, o.qty, o.ts);
                warmupEngine.process(new NewOrderCmd(cloned));
            }
            System.out.println("Warmup completed.");
            
            // Reset counters
            eventCounts[0] = 0;
            eventCounts[1] = 0;
            eventCounts[2] = 0;
            
            // 4. Main Benchmark Run
            System.out.println("Executing matching benchmarks in pure CPU/RAM memory pathway...");
            MatchingEngine engine = new MatchingEngine("BTC-USD", new ArrayBlockingQueue<>(1), outbox);
            
            long startTime = System.nanoTime();
            for (Order o : orders) {
                engine.process(new NewOrderCmd(o));
            }
            long endTime = System.nanoTime();
            
            // 5. Calculations
            long totalNanos = endTime - startTime;
            double totalSecs = totalNanos / 1_000_000_000.0;
            double throughput = orders.size() / totalSecs;
            double avgLatencyNanos = (double) totalNanos / orders.size();
            
            System.out.println("\n--------------------------------------------------");
            System.out.println("               BENCHMARK RESULTS                  ");
            System.out.println("--------------------------------------------------");
            System.out.printf("Total Executed Orders  : %,d\n", orders.size());
            System.out.printf("Elapsed Simulation Time: %,.4f ms (%,d ns)\n", totalNanos / 1_000_000.0, totalNanos);
            System.out.printf("Engine Throughput      : %,.2f orders/second\n", throughput);
            System.out.printf("Average Latency        : %,.2f nanoseconds/order (%,.4f microseconds/order)\n", 
                    avgLatencyNanos, avgLatencyNanos / 1000.0);
            
            System.out.println("\n--------------------------------------------------");
            System.out.println("               EVENT STATISTICS                   ");
            System.out.println("--------------------------------------------------");
            System.out.printf("Order Book Delta Events: %,d\n", eventCounts[0]);
            System.out.printf("Execution Trade Events : %,d\n", eventCounts[1]);
            System.out.printf("Cancelled Order Events : %,d\n", eventCounts[2]);
            System.out.println("==================================================");
            
        } catch (Exception e) {
            System.err.println("Fatal backtest execution error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
