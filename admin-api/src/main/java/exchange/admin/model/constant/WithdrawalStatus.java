package exchange.admin.model.constant;

/**
 * 암호화 자산 출금 요청 상태를 나타내는 Enum입니다.
 */
public enum WithdrawalStatus {
    /** 관리자 승인 대기 */
    PENDING,
    /** 출금 승인됨 */
    APPROVED,
    /** 관리자 거절 */
    REJECTED,
    /** 네트워크 전파됨 */
    BROADCASTED,
    /** 출금 최종 성공 */
    SUCCESS,
    /** 출금 실패 */
    FAILED
}
