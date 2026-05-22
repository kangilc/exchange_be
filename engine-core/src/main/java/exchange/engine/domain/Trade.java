package exchange.engine.domain;

public final class Trade {
    public final String symbol;
    public final long seq;
    public final long takerOrderId;
    public final long takerUserId;
    public final long makerOrderId;
    public final long makerUserId;
    public final long price;
    public final long qty;
    public final long ts;

    public Trade(String symbol, long seq, long takerOrderId, long takerUserId, long makerOrderId, long makerUserId, long price, long qty, long ts) {
        this.symbol = symbol;
        this.seq = seq;
        this.takerOrderId = takerOrderId;
        this.takerUserId = takerUserId;
        this.makerOrderId = makerOrderId;
        this.makerUserId = makerUserId;
        this.price = price;
        this.qty = qty;
        this.ts = ts;
    }
}
