package exchange.engine.book;

import exchange.engine.domain.Order;
import exchange.engine.domain.Side;

import java.util.*;

public final class OrderBook {

    public final NavigableMap<Long, ArrayDeque<Order>> bids =
            new TreeMap<>(Comparator.reverseOrder());

    public final NavigableMap<Long, ArrayDeque<Order>> asks =
            new TreeMap<>();

    public final Map<Long, Order> orderIndex = new HashMap<>();
    public final Map<Long, Long> orderPriceIndex = new HashMap<>();

    public void add(Order o) {
        var book = (o.side == Side.BUY) ? bids : asks;

        book.computeIfAbsent(o.price, k -> new ArrayDeque<>())
                .addLast(o);

        orderIndex.put(o.orderId, o);
        orderPriceIndex.put(o.orderId, o.price);
    }

    public Order find(long orderId) {
        return orderIndex.get(orderId);
    }

    public void remove(Order o) {
        var book = (o.side == Side.BUY) ? bids : asks;
        Long price = orderPriceIndex.remove(o.orderId);
        orderIndex.remove(o.orderId);

        if (price == null) return;

        var q = book.get(price);
        if (q != null) {
            q.removeIf(x -> x.orderId == o.orderId);
            if (q.isEmpty()) {
                book.remove(price);
            }
        }
    }
}
