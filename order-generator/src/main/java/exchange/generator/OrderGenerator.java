package exchange.generator;

import java.io.PrintWriter;
import java.net.Socket;
import java.util.Random;

public final class OrderGenerator {
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
            while (true) {
                try (Socket socket = new Socket(host, port);
                     PrintWriter writer = new PrintWriter(socket.getOutputStream(), true)) {

                    System.out.println("[" + symbol + "] Connected to matching engine command port! Generating trades...");
                    retryDelay = 1000;

                    // 커넥션 성공 즉시 촘촘한 20레벨 호가 시드 데이터(Seed Book) 인젝션 수행
                    generateInitialSeedBook(writer);

                    while (true) {
                        String side = rand.nextBoolean() ? "BUY" : "SELL";
                        
                        long priceOffset = rand.nextInt(100) - 50; // -50 to +49
                        long price = referencePrice + priceOffset;
                        long qty = rand.nextInt(15) + 1; // 1 to 15

                        writer.println(String.format("NEW,%s,%d,%d", side, price, qty));
                        writer.flush();

                        if (rand.nextInt(100) < 5) {
                            referencePrice += rand.nextInt(10) - 5;
                        }

                        // Places orders at a high throughput rate
                        Thread.sleep(rand.nextInt(200) + 50);
                    }

                } catch (Exception e) {
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
        }

        private void generateInitialSeedBook(PrintWriter writer) {
            System.out.println("[" + symbol + "] Generating initial 20-level thick seed book...");
            // Ask Side (SELL) - referencePrice + 1 to +10
            for (int i = 1; i <= 10; i++) {
                long price = referencePrice + i;
                long qty = 20 + new Random().nextInt(50); // 20~70 random quantity
                writer.println(String.format("NEW,SELL,%d,%d", price, qty));
            }
            // Bid Side (BUY) - referencePrice - 1 to -10
            for (int i = 1; i <= 10; i++) {
                long price = referencePrice - i;
                long qty = 20 + new Random().nextInt(50);
                writer.println(String.format("NEW,BUY,%d,%d", price, qty));
            }
            writer.flush();
            System.out.println("[" + symbol + "] Seed book injection completed successfully for " + symbol);
        }
    }
}
