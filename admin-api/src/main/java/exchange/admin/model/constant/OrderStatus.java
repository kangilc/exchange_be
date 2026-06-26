package exchange.admin.model.constant;

/**
 * 주문의 처리 진행 상태를 나타내는 Enum입니다.
 */
public enum OrderStatus {
    /** 신규 접수 상태 */
    NEW,
    /** 부분 체결 상태 */
    PARTIALLY_FILLED,
    /** 전체 체결 완료 상태 */
    FILLED,
    /** 취소 완료 상태 */
    CANCELLED
}
