package exchange.engine.event;

import exchange.engine.domain.Order;
import exchange.engine.domain.Side;

/**
 * 매칭 엔진 내부에서 발생한 체결 및 주문 변동 이벤트를 외부의 전송 컴포넌트로 내보내는 아웃박스 인터페이스입니다.
 */
public interface EventOutbox {
    /**
     * 신규 주문이 등록 완료되었을 때 호출됩니다.
     * 
     * @param symbol 거래 쌍 심볼
     * @param seq 이벤트 일련번호
     * @param order 접수된 주문 정보
     */
    void accept(String symbol, long seq, Order order);

    /**
     * 특정 가격대 호가 잔량이 변경(추가 혹은 체결/취소로 인한 감소)되었을 때 호출됩니다.
     * 
     * @param symbol 거래 쌍 심볼
     * @param seq 이벤트 일련번호
     * @param side 주문 방향 (BUY/SELL)
     * @param price 변경된 호가 가격
     * @param deltaQty 수량 변동폭 (예: 신규 호가 등록 시 +수량, 체결/취소 시 -수량)
     */
    void delta(String symbol, long seq, Side side, long price, long deltaQty);

    /**
     * 매수 주문과 매도 주문이 일치하여 체결(거래 완료)이 성사되었을 때 호출됩니다.
     * 
     * @param symbol 거래 쌍 심볼
     * @param seq 이벤트 일련번호
     * @param taker 체결을 발생시킨 주문(진입 주문)
     * @param maker 호가창에 먼저 접수되어 대기 중이던 주문
     * @param qty 체결된 거래 수량
     */
    void trade(String symbol, long seq, Order taker, Order maker, long qty);

    /**
     * 대기 중인 주문이 취소 완료되었을 때 호출됩니다.
     * 
     * @param symbol 거래 쌍 심볼
     * @param seq 이벤트 일련번호
     * @param order 취소된 주문 정보
     */
    void cancel(String symbol, long seq, Order order);

    /**
     * 아무 동작도 수행하지 않는 Dummy(No-op) 아웃박스 객체를 반환합니다.
     * 테스트 혹은 수신 장치가 필요 없는 경우에 유용합니다.
     */
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
