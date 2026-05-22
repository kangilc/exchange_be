package exchange.engine.domain;

public final class Order {
    public final long orderId;
    public final Side side;
    public final long price; // Integer-based price (e.g. 65000.00 -> 6500000)
    public long qty;
    public final long ts;

    public Order(long orderId, Side side, long price, long qty, long ts) {
        this.orderId = orderId;
        this.side = side;
        this.price = price;
        this.qty = qty;
        this.ts = ts;
    }
}
