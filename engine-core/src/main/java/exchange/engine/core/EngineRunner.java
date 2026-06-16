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

/**
 * 매칭 엔진 프로세스를 구동하는 메인 진입점 클래스입니다.
 * 주문 명령어(Command)를 받아들이는 TCP 서버와, 매칭 이벤트를 구독자들에게 전송하는 TCP 서버를 시작하고
 * 백그라운드 매칭 엔진 스레드를 조율합니다.
 */
public final class EngineRunner {
    // 주문 명령어 입력을 받는 포트 (기본값: 9999)
    private static final int COMMAND_PORT = ConfigLoader.getInt("COMMAND_PORT", 9999);
    // 발생한 체결/취소 이벤트를 외부로 전송하는 포트 (기본값: 9998)
    private static final int EVENT_PORT = ConfigLoader.getInt("ENGINE_PORT", 9998);

    // 이벤트 구독(연결) 중인 소켓의 출력 스트림 리스트
    private static final List<PrintWriter> eventClients = new CopyOnWriteArrayList<>();
    // 매칭 엔진이 처리할 주문 명령어 대기 큐
    private static final BlockingQueue<Command> commandQueue = new ArrayBlockingQueue<>(1_000_000);

    public static void main(String[] args) {
        // 매칭을 수행할 대상 심볼 정보 (기본값: BTC-USD)
        String symbol = ConfigLoader.get("SYMBOL", "BTC-USD");

        System.out.println("Starting Matching Engine for symbol: " + symbol);

        // 1. 이벤트 브로드캐스터 구현체 (매칭 엔진에서 발생한 이벤트를 접속한 모든 TCP 클라이언트에 브로드캐스트)
        EventOutbox TCPBroadcasterOutbox = new EventOutbox() {
            @Override
            public void accept(String symbol, long seq, Order order) {
                broadcast(String.format("ACCEPT,%s,%d,%d,%d,%s,%d,%d", symbol, seq, order.orderId, order.userId, order.side.name(), order.price, order.qty));
            }

            @Override
            public void delta(String symbol, long seq, Side side, long price, long deltaQty) {
                broadcast(String.format("DELTA,%s,%d,%s,%d,%d", symbol, seq, side.name(), price, deltaQty));
            }

            @Override
            public void trade(String symbol, long seq, Order taker, Order maker, long qty) {
                broadcast(String.format("TRADE,%s,%d,%d,%d,%d,%d,%d,%d", symbol, seq, taker.orderId, taker.userId, maker.orderId, maker.userId, maker.price, qty));
            }

            @Override
            public void cancel(String symbol, long seq, Order order) {
                broadcast(String.format("CANCEL,%s,%d,%d,%d", symbol, seq, order.orderId, order.userId));
            }
        };

        // 2. 실제 매칭 연산을 처리할 매칭 엔진 인스턴스 생성 및 스레드 시작
        MatchingEngine engine = new MatchingEngine(symbol, commandQueue, TCPBroadcasterOutbox);
        Thread engineThread = new Thread(engine, "engine-" + symbol);
        engineThread.start();

        // 메트릭스 및 스냅샷 조회를 위한 내장 HTTP 서버 구동
        MetricsServer.getInstance().start(engine);

        // 3. 이벤트 브로드캐스팅 서버 소켓 열기 (체결 내역 등을 수신할 리스너 구동)
        startEventServer();

        // 4. 주문 명령어 수신 소켓 열기 (외부 게이트웨이 등으로부터 주문 입력을 처리)
        startCommandServer();
    }

    /**
     * 연결된 모든 이벤트 구독 소켓 클라이언트에 로그 메시지를 브로드캐스트합니다.
     */
    private static void broadcast(String message) {
        for (PrintWriter writer : eventClients) {
            try {
                writer.println(message);
                writer.flush();
            } catch (Exception e) {
                // 클라이언트 연결이 끊어진 경우 구독 목록에서 안전하게 제외
                eventClients.remove(writer);
            }
        }
    }

    /**
     * 외부 이벤트 전송용 TCP 서버를 백그라운드 스레드에서 구동합니다.
     */
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

    /**
     * 외부 주문 명령 입력을 수신하는 TCP 서버를 구동합니다.
     */
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
                            
                            // 프로토콜 형식: NEW,BUY/SELL,price,qty,userId 또는 CANCEL,orderId
                            String[] parts = line.split(",");
                            if (parts[0].equalsIgnoreCase("NEW")) {
                                Side side = Side.valueOf(parts[1].toUpperCase());
                                long price = Long.parseLong(parts[2]);
                                long qty = Long.parseLong(parts[3]);
                                long userId = parts.length > 4 ? Long.parseLong(parts[4]) : 1;
                                long orderId = idCounter++;
                                
                                Order order = new Order(orderId, userId, side, price, qty, System.currentTimeMillis());
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
                
                // 멀티스레드 환경에서 안전하게 고유 orderId 범위를 관리하기 위해 일정 간격 점프
                orderIdCounter += 1000000;
            }
        } catch (Exception e) {
            System.err.println("Command server error: " + e.getMessage());
        }
    }
}
