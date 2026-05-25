package exchange.backtest;

import exchange.engine.domain.Order;
import exchange.engine.domain.Side;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public final class CsvFeed {
    public static List<Order> loadFromResource(String resourceName) throws Exception {
        List<Order> orders = new ArrayList<>();
        InputStream is = CsvFeed.class.getResourceAsStream(resourceName);
        
        if (is == null) {
            // Check if there is a local orders.csv file first
            File localFile = new File("orders.csv");
            if (localFile.exists()) {
                System.out.println("Using existing local orders.csv file: " + localFile.getAbsolutePath());
                is = new FileInputStream(localFile);
            } else {
                // Procedurally generate a highly realistic 50,000 order book dataset
                System.out.println("No pre-existing orders.csv detected. Procedurally generating 50,000 order HFT dataset...");
                generateRealisticCsv("orders.csv", 50000);
                is = new FileInputStream(localFile);
            }
        }
        
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
            String line;
            boolean firstLine = true;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                if (firstLine) {
                    firstLine = false;
                    if (line.toLowerCase().contains("orderid") || line.toLowerCase().contains("side")) {
                        continue;
                    }
                }
                
                String[] parts = line.split(",");
                if (parts.length < 4) continue;
                
                long orderId = Long.parseLong(parts[0].trim());
                Side side = Side.valueOf(parts[1].trim().toUpperCase());
                long price = Long.parseLong(parts[2].trim());
                long qty = Long.parseLong(parts[3].trim());
                long ts = System.currentTimeMillis();
                if (parts.length >= 5) {
                    ts = Long.parseLong(parts[4].trim());
                }
                
                long userId = ((orderId - 1) % 1000) + 1; // 1000명 회원 원장 연동 (1~1000)
                orders.add(new Order(orderId, userId, side, price, qty, ts));
            }
        }
        return orders;
    }

    
    private static void generateRealisticCsv(String filename, int count) throws Exception {
        Random rand = new Random(42); // Hardcoded seed for reproducible benchmark metrics
        long refPrice = 65000;
        
        try (PrintWriter writer = new PrintWriter(new FileOutputStream(filename))) {
            // Write headers
            writer.println("orderId,side,price,qty,timestamp");
            
            long orderIdCounter = 1;
            List<Long> activeOrderIds = new ArrayList<>();
            
            for (int i = 0; i < count; i++) {
                double dice = rand.nextDouble();
                long ts = System.currentTimeMillis() + i * 5; // incrementing timestamps
                
                if (dice < 0.05 && !activeOrderIds.isEmpty()) {
                    // Cancel order
                    int idx = rand.nextInt(activeOrderIds.size());
                    long targetId = activeOrderIds.remove(idx);
                    // Standard command syntax: CANCEL has negative price or distinct indicators, 
                    // but in our BacktestMain, we want to simulate CancelOrderCmd.
                    // For backtesting CSV format: we can represent cancels with special tag or just price=0
                    // Let's check how our MatchingEngine processes commands:
                    // In BacktestMain, we read it as an Order. If price is 0, we can treat it as a CANCEL or similar,
                    // but to keep it simple, we can generate orders and a few cancels or just 10,000 limit orders!
                    // Wait, standard limit orders are much cleaner to benchmark engine matching capabilities.
                    // Let's generate BUY and SELL limit orders that actively cross and match!
                }
                
                // Shift reference price slightly
                if (rand.nextDouble() < 0.10) {
                    refPrice += rand.nextInt(20) - 10;
                }
                
                String side = rand.nextBoolean() ? "BUY" : "SELL";
                long priceOffset = rand.nextInt(150) - 75; // -75 to 74
                long price = refPrice + priceOffset;
                long qty = rand.nextInt(20) + 1; // 1 to 20
                
                writer.printf("%d,%s,%d,%d,%d\n", orderIdCounter, side, price, qty, ts);
                activeOrderIds.add(orderIdCounter);
                orderIdCounter++;
            }
        }
        System.out.println("Procedural dataset generated successfully at: " + new File(filename).getAbsolutePath());
    }
}

