package exchange.engine.domain;

/**
 * 매칭 엔진 내에서 매수 주문과 매도 주문이 정상 체결되어 발생한 체결 내역 정보 모델 클래스입니다.
 */
public final class Trade {
    // 거래 대상 심볼 (예: BTC-USD)
    public final String symbol;
    // 체결 일련번호 (Sequence Number)
    public final long seq;
    // 체결을 유도한 주문(Taker)의 ID
    public final long takerOrderId;
    // 체결을 유도한 주문의 사용자 ID
    public final long takerUserId;
    // 기존에 호가창에서 대기하고 있던 주문(Maker)의 ID
    public final long makerOrderId;
    // 대기 주문(Maker)을 등록한 사용자 ID
    public final long makerUserId;
    // 체결된 가격 (스케일 업 정수값)
    public final long price;
    // 체결 수량
    public final long qty;
    // 체결이 발생한 타임스탬프 밀리초
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
