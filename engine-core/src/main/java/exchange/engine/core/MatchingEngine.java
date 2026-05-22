package exchange.engine.core;

import exchange.engine.book.OrderBook;
import exchange.engine.command.CancelOrderCmd;
import exchange.engine.command.Command;
import exchange.engine.command.NewOrderCmd;
import exchange.engine.domain.Order;
import exchange.engine.domain.Side;
import exchange.engine.event.EventOutbox;

import java.util.concurrent.BlockingQueue;

public final class MatchingEngine implements Runnable {
    private final String symbol;
    private final BlockingQueue<Command> queue;
    private final OrderBook book;
    private final EventOutbox outbox;
    private long seq = 0;
    private boolean running = true;

    public MatchingEngine(String symbol, BlockingQueue<Command> queue, EventOutbox outbox) {
        this.symbol = symbol;
        this.queue = queue;
        this.book = new OrderBook();
        this.outbox = outbox;
    }

    @Override
    public void run() {
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

    public void stop() {
        this.running = false;
    }

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
        MetricsServer.getInstance().recordMatch(durationNs / 1000);
    }

    private void processNewOrder(Order order) {
        if (order.side == Side.BUY) {
            matchBuy(order);
        } else {
            matchSell(order);
        }
    }

    private void matchBuy(Order buy) {
        while (buy.qty > 0 && !book.asks.isEmpty()) {
            var best = book.asks.firstEntry();
            if (best.getKey() > buy.price) break;

            var resting = best.getValue().peekFirst();
            if (resting == null) {
                book.asks.remove(best.getKey());
                continue;
            }

            long traded = Math.min(buy.qty, resting.qty);

            buy.qty -= traded;
            resting.qty -= traded;
            seq++;

            // 1. Emit trade event
            outbox.trade(symbol, seq, buy, resting, traded);

            // 2. Emit delta event for the matched resting ask (decreased quantity)
            outbox.delta(symbol, seq, Side.SELL, resting.price, -traded);

            if (resting.qty == 0) {
                best.getValue().pollFirst();
                book.orderIndex.remove(resting.orderId);
                book.orderPriceIndex.remove(resting.orderId);
            }
            if (best.getValue().isEmpty()) {
                book.asks.remove(best.getKey());
            }
        }

        // If there's remaining quantity, add it as a resting bid
        if (buy.qty > 0) {
            book.add(buy);
            seq++;
            outbox.delta(symbol, seq, Side.BUY, buy.price, buy.qty);
        }
    }

    private void matchSell(Order sell) {
        while (sell.qty > 0 && !book.bids.isEmpty()) {
            var best = book.bids.firstEntry();
            if (best.getKey() < sell.price) break;

            var resting = best.getValue().peekFirst();
            if (resting == null) {
                book.bids.remove(best.getKey());
                continue;
            }

            long traded = Math.min(sell.qty, resting.qty);

            sell.qty -= traded;
            resting.qty -= traded;
            seq++;

            // 1. Emit trade event
            outbox.trade(symbol, seq, resting, sell, traded);

            // 2. Emit delta event for the matched resting bid (decreased quantity)
            outbox.delta(symbol, seq, Side.BUY, resting.price, -traded);

            if (resting.qty == 0) {
                best.getValue().pollFirst();
                book.orderIndex.remove(resting.orderId);
                book.orderPriceIndex.remove(resting.orderId);
            }
            if (best.getValue().isEmpty()) {
                book.bids.remove(best.getKey());
            }
        }

        // If there's remaining quantity, add it as a resting ask
        if (sell.qty > 0) {
            book.add(sell);
            seq++;
            outbox.delta(symbol, seq, Side.SELL, sell.price, sell.qty);
        }
    }

    private void processCancelOrder(long orderId) {
        Order order = book.find(orderId);
        if (order != null) {
            book.remove(order);
            seq++;
            outbox.cancel(symbol, seq, order);
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
