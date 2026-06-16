package exchange.engine.command;

/**
 * 매칭 엔진이 수신하여 처리하는 모든 주문 조작 명령어들의 공통 부모 인터페이스입니다.
 * sealed 키워드를 적용하여 오직 NewOrderCmd(주문 접수)와 CancelOrderCmd(주문 취소) 구현체만 상속/구현할 수 있게 제한합니다.
 */
public sealed interface Command permits NewOrderCmd, CancelOrderCmd {
}
