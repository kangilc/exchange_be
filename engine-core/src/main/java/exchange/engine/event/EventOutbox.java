package exchange.engine.event;

import exchange.engine.domain.Order;
import exchange.engine.domain.Side;

public interface EventOutbox {
    void accept(String symbol, long seq, Order order);
    void delta(String symbol, long seq, Side side, long price, long deltaQty);
    void trade(String symbol, long seq, Order taker, Order maker, long qty);
    void cancel(String symbol, long seq, Order order);

    static EventOutbox noop() {
        return new EventOutbox() {
            @Override
            public void accept(String symbol, long seq, Order order) {}

            @Override
            public void delta(String symbol, long seq, Side side, long price, long deltaQty) {}

            @Override
            public void trade(String symbol, long seq, Order taker, Order maker, long qty) {}

            @Override
            public void cancel(String symbol, long seq, Order order) {}
        };
    }
}
