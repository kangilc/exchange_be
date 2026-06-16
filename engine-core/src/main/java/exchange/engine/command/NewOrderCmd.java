package exchange.engine.command;

import exchange.engine.domain.Order;

/**
 * 신규 주문을 매칭 엔진에 접수하여 처리하도록 요청하는 레코드 명령어 클래스입니다.
 * 
 * @param order 접수할 신규 주문 정보 객체
 */
public record NewOrderCmd(Order order) implements Command {
}
