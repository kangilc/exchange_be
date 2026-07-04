package exchange.admin.service;

import java.math.BigDecimal;

/**
 * 코인별 온체인 출금 처리 인터페이스
 */
public interface CoinWithdrawService {
    /**
     * 지정된 주소로 코인 송금을 실행하고 트랜잭션 해시를 반환한다.
     *
     * @param toAddress 수신자 지갑 주소
     * @param amount 송금 수량
     * @return 온체인 트랜잭션 해시
     * @throws Exception 온체인 전송 실패 시 예외 발생
     */
    String withdraw(String toAddress, BigDecimal amount) throws Exception;

    /**
     * 해당 코인 종류를 지원하는지 여부를 반환한다.
     *
     * @param currency 코인 심볼 (예: BTC, ADA, JAF)
     * @return 지원 여부
     */
    boolean supports(String currency);
}
