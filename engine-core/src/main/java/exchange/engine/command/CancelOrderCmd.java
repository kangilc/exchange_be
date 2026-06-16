package exchange.engine.command;

/**
 * 대기 중인 주문을 호가창에서 취소하도록 매칭 엔진에 요청하는 레코드 명령어 클래스입니다.
 * 
 * @param orderId 취소할 대상 주문의 고유 ID
 */
public record CancelOrderCmd(long orderId) implements Command {
}
