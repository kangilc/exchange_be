package exchange.generator;

import java.io.PrintWriter;
import java.net.Socket;
import java.util.Random;

public final class OrderGenerator {
    public static void main(String[] args) {
        String engineHost = ConfigLoader.get("ENGINE_HOST", "localhost");
        int enginePort = ConfigLoader.getInt("COMMAND_PORT", ConfigLoader.getInt("ENGINE_PORT", 9999));


        System.out.println("Starting Order Generator...");
        System.out.println("Target Matching Engine: " + engineHost + ":" + enginePort);

        Random rand = new Random();
        long referencePrice = 65000; // Reference price of 650.00 (scaled by 100) or 65000 directly

        long retryDelay = 1000;
        while (true) {
            try (Socket socket = new Socket(engineHost, enginePort);
                 PrintWriter writer = new PrintWriter(socket.getOutputStream(), true)) {

                System.out.println("Connected to Matching Engine command port! Generating trades...");
                retryDelay = 1000;

                while (true) {
                    // 1. Generate randomized order features
                    String side = rand.nextBoolean() ? "BUY" : "SELL";
                    
                    // Spread prices dynamically around reference price to trigger matching matches
                    long priceOffset = rand.nextInt(100) - 50; // -50 to +49
                    long price = referencePrice + priceOffset;
                    long qty = rand.nextInt(15) + 1; // 1 to 15

                    // 2. Transmit through command protocol: NEW,BUY/SELL,price,qty
                    writer.println(String.format("NEW,%s,%d,%d", side, price, qty));
                    writer.flush();

                    // Dynamically shift reference price slightly to simulate market volatility
                    if (rand.nextInt(100) < 5) {
                        referencePrice += rand.nextInt(10) - 5;
                    }

                    // Sleep between orders (simulates high throughput)
                    Thread.sleep(rand.nextInt(400) + 100); // places orders every 100ms - 500ms
                }

            } catch (Exception e) {
                System.err.println("Lost connection to Matching Engine command port: " + e.getMessage());
                System.err.println("Reconnecting in " + retryDelay + "ms...");
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
}
