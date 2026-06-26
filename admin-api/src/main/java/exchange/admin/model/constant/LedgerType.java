package exchange.admin.model.constant;

/**
 * 자산 변경(원장) 내역의 사유 유형을 나타내는 Enum입니다.
 */
public enum LedgerType {
    /** 입금 */
    DEPOSIT,
    /** 출금 */
    WITHDRAWAL,
    /** 주문 보류 잠금 */
    ORDER_HOLD,
    /** 거래 체결 정산 */
    TRADE_SETTLE,
    /** 주문 취소 잠금 해제 */
    CANCEL_RELEASE,
    /** 거래 수수료 납부 */
    FEE_PAID,
    /** 거래 수수료 세입 적립 */
    FEE_REVENUE
}
