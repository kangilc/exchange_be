package exchange.engine.domain;

/**
 * 매칭 엔진 호가창에 등록되거나 매칭되는 개별 주문 정보를 담는 엔티티 클래스입니다.
 */
public final class Order {
    // 주문 고유 ID
    public final long orderId;
    // 주문을 낸 사용자 고유 ID
    public final long userId;
    // 주문 방향 (BUY/SELL)
    public final Side side;
    // 주문 가격 (소수점 자릿수 보존을 위해 정수형으로 저장하며, 예: 65000.00 -> 6500000 으로 스케일 업)
    public final long price;
    // 주문 수량 (남은 미체결 수량)
    public long qty;
    // 주문이 생성된 타임스탬프 밀리초
    public final long ts;

    public Order(long orderId, long userId, Side side, long price, long qty, long ts) {
        this.orderId = orderId;
        this.userId = userId;
        this.side = side;
        this.price = price;
        this.qty = qty;
        this.ts = ts;
    }
}
