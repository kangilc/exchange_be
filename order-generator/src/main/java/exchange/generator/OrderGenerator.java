package exchange.generator;

import java.io.PrintWriter;
import java.net.Socket;
import java.util.Random;

public final class OrderGenerator {
    private static final java.util.concurrent.atomic.AtomicInteger totalOrderCount = new java.util.concurrent.atomic.AtomicInteger(0);
    private static final int MAX_ORDERS = 10000;

    public static void main(String[] args) {
        String btcHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        String adaHost = ConfigLoader.get("ADA_ENGINE_HOST", btcHost);
        int btcPort = ConfigLoader.getInt("COMMAND_PORT", 9999);
        int adaPort = ConfigLoader.getInt("ADA_COMMAND_PORT", 9997);

        System.out.println("Starting Multi-Symbol Order Generator...");
        System.out.println("Target Matching Engines:");
        System.out.println(" - BTC-USD command port: " + btcHost + ":" + btcPort);
        System.out.println(" - ADA-KRW command port: " + adaHost + ":" + adaPort);

        // Start BTC-USD generator thread
        Thread btcThread = new Thread(new GeneratorTask(btcHost, btcPort, 65000, "BTC-USD"), "generator-btc");
        // Start ADA-KRW generator thread
        Thread adaThread = new Thread(new GeneratorTask(adaHost, adaPort, 50000, "ADA-KRW"), "generator-ada");

        btcThread.start();
        adaThread.start();

        try {
            btcThread.join();
            adaThread.join();
        } catch (InterruptedException e) {
            System.err.println("Main thread interrupted.");
        }
    }

    private static class GeneratorTask implements Runnable {
        private final String host;
        private final int port;
        private long referencePrice;
        private final String symbol;

        public GeneratorTask(String host, int port, long referencePrice, String symbol) {
            this.host = host;
            this.port = port;
            this.referencePrice = referencePrice;
            this.symbol = symbol;
        }

        @Override
        public void run() {
            Random rand = new Random();
            long retryDelay = 1000;
            while (totalOrderCount.get() < MAX_ORDERS) {
                try (Socket socket = new Socket(host, port);
                     PrintWriter writer = new PrintWriter(socket.getOutputStream(), true)) {

                    System.out.println("[" + symbol + "] Connected to matching engine command port! Generating trades...");
                    retryDelay = 1000;

                    // 커넥션 성공 즉시 촘촘한 20레벨 호가 시드 데이터(Seed Book) 인젝션 수행
                    generateInitialSeedBook(writer);

                    while (totalOrderCount.get() < MAX_ORDERS) {
                        String side = rand.nextBoolean() ? "BUY" : "SELL";
                        
                        long priceOffset = rand.nextInt(100) - 50; // -50 to +49
                        long price = referencePrice + priceOffset;
                        long qty = rand.nextInt(15) + 1; // 1 to 15
                        long userId = rand.nextInt(1000) + 1; // 1000명 회원 중 랜덤 ID (1~1000)

                        if (totalOrderCount.incrementAndGet() > MAX_ORDERS) {
                            System.out.println("[" + symbol + "] Target order limit of " + MAX_ORDERS + " reached. Exiting generator loop.");
                            break;
                        }

                        writer.println(String.format("NEW,%s,%d,%d,%d", side, price, qty, userId));
                        writer.flush();

                        if (rand.nextInt(100) < 5) {
                            referencePrice += rand.nextInt(10) - 5;
                        }

                        // Places orders at a high throughput rate
                        Thread.sleep(rand.nextInt(200) + 50);
                    }

                } catch (Exception e) {
                    if (totalOrderCount.get() >= MAX_ORDERS) {
                        break;
                    }
                    System.err.println("[" + symbol + "] Lost connection: " + e.getMessage());
                    System.err.println("[" + symbol + "] Reconnecting in " + retryDelay + "ms...");
                    try {
                        Thread.sleep(retryDelay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                    retryDelay = Math.min(retryDelay * 2, 30000);
                }
            }
            System.out.println("[" + symbol + "] Generator task stopped successfully.");
        }

        private void generateInitialSeedBook(PrintWriter writer) {
            System.out.println("[" + symbol + "] Generating initial 20-level thick seed book...");
            Random r = new Random();
            // Ask Side (SELL) - referencePrice + 1 to +10
            for (int i = 1; i <= 10; i++) {
                long price = referencePrice + i;
                long qty = 20 + r.nextInt(50); // 20~70 random quantity
                long userId = r.nextInt(1000) + 1; // 1000명 회원 중 랜덤 ID (1~1000)
                writer.println(String.format("NEW,SELL,%d,%d,%d", price, qty, userId));
            }
            // Bid Side (BUY) - referencePrice - 1 to -10
            for (int i = 1; i <= 10; i++) {
                long price = referencePrice - i;
                long qty = 20 + r.nextInt(50);
                long userId = r.nextInt(1000) + 1; // 1000명 회원 중 랜덤 ID (1~1000)
                writer.println(String.format("NEW,BUY,%d,%d,%d", price, qty, userId));
            }
            writer.flush();
            System.out.println("[" + symbol + "] Seed book injection completed successfully for " + symbol);
        }

    }
}
