package exchange.engine.core;

import exchange.engine.command.CancelOrderCmd;
import exchange.engine.command.Command;
import exchange.engine.command.NewOrderCmd;
import exchange.engine.domain.Order;
import exchange.engine.domain.Side;
import exchange.engine.event.EventOutbox;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;

public final class EngineRunner {
    private static final int COMMAND_PORT = 9999;
    private static final int EVENT_PORT = 9998;

    private static final List<PrintWriter> eventClients = new CopyOnWriteArrayList<>();
    private static final BlockingQueue<Command> commandQueue = new ArrayBlockingQueue<>(1_000_000);

    public static void main(String[] args) {
        String symbol = System.getenv("SYMBOL");
        if (symbol == null || symbol.isEmpty()) {
            symbol = "BTC-USD";
        }

        System.out.println("Starting Matching Engine for symbol: " + symbol);

        // 1. Create event outbox that broadcasts matching events to all connected TCP clients
        EventOutbox TCPBroadcasterOutbox = new EventOutbox() {
            @Override
            public void delta(String symbol, long seq, Side side, long price, long deltaQty) {
                broadcast(String.format("DELTA,%s,%d,%s,%d,%d", symbol, seq, side.name(), price, deltaQty));
            }

            @Override
            public void trade(String symbol, long seq, Order taker, Order maker, long qty) {
                broadcast(String.format("TRADE,%s,%d,%d,%d,%d,%d", symbol, seq, taker.orderId, maker.orderId, maker.price, qty));
            }

            @Override
            public void cancel(String symbol, long seq, Order order) {
                broadcast(String.format("CANCEL,%s,%d,%d", symbol, seq, order.orderId));
            }
        };

        // 2. Start Matching Engine thread
        MatchingEngine engine = new MatchingEngine(symbol, commandQueue, TCPBroadcasterOutbox);
        Thread engineThread = new Thread(engine, "engine-" + symbol);
        engineThread.start();

        // 3. Start Event Broadcast Server
        startEventServer();

        // 4. Start Command Server (accepts incoming order commands)
        startCommandServer();
    }

    private static void broadcast(String message) {
        for (PrintWriter writer : eventClients) {
            try {
                writer.println(message);
                writer.flush();
            } catch (Exception e) {
                // Client disconnected
                eventClients.remove(writer);
            }
        }
    }

    private static void startEventServer() {
        Thread thread = new Thread(() -> {
            try (ServerSocket serverSocket = new ServerSocket(EVENT_PORT)) {
                System.out.println("Event Broadcaster Server listening on port " + EVENT_PORT);
                while (true) {
                    Socket socket = serverSocket.accept();
                    System.out.println("New Event Subscriber connected from " + socket.getRemoteSocketAddress());
                    PrintWriter writer = new PrintWriter(socket.getOutputStream(), true);
                    eventClients.add(writer);
                }
            } catch (Exception e) {
                System.err.println("Event server error: " + e.getMessage());
            }
        }, "event-server");
        thread.setDaemon(true);
        thread.start();
    }

    private static void startCommandServer() {
        try (ServerSocket serverSocket = new ServerSocket(COMMAND_PORT)) {
            System.out.println("Command Ingestion Server listening on port " + COMMAND_PORT);
            long orderIdCounter = 1;
            while (true) {
                Socket socket = serverSocket.accept();
                System.out.println("Command Client connected from " + socket.getRemoteSocketAddress());
                
                final long startId = orderIdCounter;
                Thread clientThread = new Thread(() -> {
                    long idCounter = startId;
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            if (line.isEmpty()) continue;
                            
                            // Protocol: NEW,BUY/SELL,price,qty  or  CANCEL,orderId
                            String[] parts = line.split(",");
                            if (parts[0].equalsIgnoreCase("NEW")) {
                                Side side = Side.valueOf(parts[1].toUpperCase());
                                long price = Long.parseLong(parts[2]);
                                long qty = Long.parseLong(parts[3]);
                                long orderId = idCounter++;
                                
                                Order order = new Order(orderId, side, price, qty, System.currentTimeMillis());
                                commandQueue.put(new NewOrderCmd(order));
                            } else if (parts[0].equalsIgnoreCase("CANCEL")) {
                                long targetOrderId = Long.parseLong(parts[1]);
                                commandQueue.put(new CancelOrderCmd(targetOrderId));
                            }
                        }
                    } catch (Exception e) {
                        System.out.println("Command client disconnected: " + e.getMessage());
                    }
                });
                clientThread.setDaemon(true);
                clientThread.start();
                
                // Keep orderIdCounter safe across threads (rough approximation for mock)
                orderIdCounter += 1000000;
            }
        } catch (Exception e) {
            System.err.println("Command server error: " + e.getMessage());
        }
    }
}
