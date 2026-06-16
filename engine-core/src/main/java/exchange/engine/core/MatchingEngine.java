package exchange.engine.core;

import exchange.engine.book.OrderBook;
import exchange.engine.command.CancelOrderCmd;
import exchange.engine.command.Command;
import exchange.engine.command.NewOrderCmd;
import exchange.engine.domain.Order;
import exchange.engine.domain.Side;
import exchange.engine.event.EventOutbox;

import java.util.concurrent.BlockingQueue;

/**
 * 실제로 메모리 상에서 매수/매도 주문 호가를 매칭(체결)하고, 호가창 상태를 관리하는 메인 매칭 엔진 클래스입니다.
 * Runnable을 구현하여 독립된 스레드 루프 내에서 대기 큐로부터 주문 명령어를 가져와 순차적으로 동기적으로 처리합니다.
 */
public final class MatchingEngine implements Runnable {
    // 본 매칭 엔진이 처리하는 거래 쌍 심볼 (예: BTC-USD)
    private final String symbol;
    // 외부로부터 수신된 매칭/취소 명령어가 적재되는 대기 큐
    private final BlockingQueue<Command> queue;
    // 인메모리 주문 원장 (오더북 호가창 객체)
    private final OrderBook book;
    // 매칭 결과를 외부로 전송하기 위한 브로드캐스트 아웃박스
    private final EventOutbox outbox;
    // 매칭 엔진 이벤트 일련번호 (Sequence Number)
    private long seq = 0;
    // 매칭 엔진 루프 동작 플래그
    private boolean running = true;

    public MatchingEngine(String symbol, BlockingQueue<Command> queue, EventOutbox outbox) {
        this.symbol = symbol;
        this.queue = queue;
        this.book = new OrderBook();
        this.outbox = outbox;
    }

    @Override
    public void run() {
        // 백그라운드 스레드에서 무한 루프를 돌며 큐의 주문을 차례대로 매칭 처리
        while (running) {
            try {
                Command cmd = queue.take();
                process(cmd);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    /**
     * 엔진 루프 동작을 정지합니다.
     */
    public void stop() {
        this.running = false;
    }

    /**
     * 개별 명령어를 분석하여 주문 등록 혹은 취소 처리를 수행하고 수행 메트릭을 기록합니다.
     * 
     * @param cmd 수행할 오더 명령어 (NewOrderCmd 또는 CancelOrderCmd)
     */
    public void process(Command cmd) {
        long startTime = System.nanoTime();
        if (cmd instanceof NewOrderCmd newOrderCmd) {
            MetricsServer.getInstance().incrementOrders();
            seq++;
            outbox.accept(symbol, seq, newOrderCmd.order());
            processNewOrder(newOrderCmd.order());
        } else if (cmd instanceof CancelOrderCmd cancelOrderCmd) {
            processCancelOrder(cancelOrderCmd.orderId());
        }
        long durationNs = System.nanoTime() - startTime;
        // 체결 매칭 수행 지연 시간(Latency)을 마이크로초(us) 단위로 모니터링 메트릭에 기록
        MetricsServer.getInstance().recordMatch(durationNs / 1000);
    }

    /**
     * 신규 주문의 방향에 따라 매칭 메소드로 분기합니다.
     */
    private void processNewOrder(Order order) {
        if (order.side == Side.BUY) {
            matchBuy(order);
        } else {
            matchSell(order);
        }
    }

    /**
     * 매수 주문을 처리하여 매도 호가창(asks)의 최고 유리한 가격 호가와 매칭시킵니다.
     */
    private void matchBuy(Order buy) {
        // 매수 주문 수량이 남아있고, 매도 호가창에 잔량이 있는 동안 반복 체결
        while (buy.qty > 0 && !book.asks.isEmpty()) {
            var best = book.asks.firstEntry(); // 가장 낮은 매도 가격 호가
            if (best.getKey() > buy.price) break; // 매수자가 원하는 최대 가격보다 매도 호가가 비싸면 체결 중단

            var resting = best.getValue().peekFirst(); // 해당 호가 가격의 가장 오래된 대기 주문
            if (resting == null) {
                book.asks.remove(best.getKey());
                continue;
            }

            // 체결 가능 수량 계산
            long traded = Math.min(buy.qty, resting.qty);

            buy.qty -= traded;
            resting.qty -= traded;
            seq++;

            // 1. 체결 이벤트(TRADE) 발행
            outbox.trade(symbol, seq, buy, resting, traded);

            // 2. 대기하고 있던 매도 주문의 수량 감소 델타(DELTA) 이벤트 발행
            outbox.delta(symbol, seq, Side.SELL, resting.price, -traded);

            // 대기 주문이 완전히 체결된 경우 목록에서 제거
            if (resting.qty == 0) {
                best.getValue().pollFirst();
                book.orderIndex.remove(resting.orderId);
                book.orderPriceIndex.remove(resting.orderId);
            }
            if (best.getValue().isEmpty()) {
                book.asks.remove(best.getKey());
            }
        }

        // 매칭 후 남은 수량이 있다면 매수 호가창(bids)에 잔량 대기 주문으로 등록
        if (buy.qty > 0) {
            book.add(buy);
            seq++;
            outbox.delta(symbol, seq, Side.BUY, buy.price, buy.qty);
        }
    }

    /**
     * 매도 주문을 처리하여 매수 호가창(bids)의 최고 유리한 가격 호가와 매칭시킵니다.
     */
    private void matchSell(Order sell) {
        // 매도 주문 수량이 남아있고, 매수 호가창에 잔량이 있는 동안 반복 체결
        while (sell.qty > 0 && !book.bids.isEmpty()) {
            var best = book.bids.firstEntry(); // 가장 높은 매수 가격 호가
            if (best.getKey() < sell.price) break; // 매도자가 원하는 최소 가격보다 매수 호가가 낮으면 체결 중단

            var resting = best.getValue().peekFirst(); // 해당 호가 가격의 가장 오래된 대기 주문
            if (resting == null) {
                book.bids.remove(best.getKey());
                continue;
            }

            // 체결 가능 수량 계산
            long traded = Math.min(sell.qty, resting.qty);

            sell.qty -= traded;
            resting.qty -= traded;
            seq++;

            // 1. 체결 이벤트(TRADE) 발행
            outbox.trade(symbol, seq, resting, sell, traded);

            // 2. 대기하고 있던 매수 주문의 수량 감소 델타(DELTA) 이벤트 발행
            outbox.delta(symbol, seq, Side.BUY, resting.price, -traded);

            // 대기 주문이 완전히 체결된 경우 목록에서 제거
            if (resting.qty == 0) {
                best.getValue().pollFirst();
                book.orderIndex.remove(resting.orderId);
                book.orderPriceIndex.remove(resting.orderId);
            }
            if (best.getValue().isEmpty()) {
                book.bids.remove(best.getKey());
            }
        }

        // 매칭 후 남은 수량이 있다면 매도 호가창(asks)에 잔량 대기 주문으로 등록
        if (sell.qty > 0) {
            book.add(sell);
            seq++;
            outbox.delta(symbol, seq, Side.SELL, sell.price, sell.qty);
        }
    }

    /**
     * 미체결 대기 주문을 취소하고 호가창에서 제거합니다.
     */
    private void processCancelOrder(long orderId) {
        Order order = book.find(orderId);
        if (order != null) {
            book.remove(order);
            seq++;
            outbox.cancel(symbol, seq, order);
            // 호가창 잔량 델타 반영 (수량 음수 처리)
            outbox.delta(symbol, seq, order.side, order.price, -order.qty);
        }
    }

    public OrderBook getOrderBook() {
        return book;
    }

    public long getSeq() {
        return seq;
    }
}
