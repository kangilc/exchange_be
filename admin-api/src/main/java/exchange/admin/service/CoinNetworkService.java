package exchange.admin.service;

import java.math.BigDecimal;

/**
 * 코인별 온체인 네트워크 입출금 연동 공통 인터페이스.
 * 새로운 블록체인 메인넷이나 토큰 자산이 추가될 때 이 인터페이스를 구현하여 기능을 확장한다.
 */
public interface CoinNetworkService {

    /**
     * 외부 수신 주소로 자산을 송금(출금)하고 온체인 트랜잭션 해시를 반환한다.
     *
     * @param toAddress 수신자 지갑 주소
     * @param amount 송금 수량
     * @return 온체인 트랜잭션 해시 (TXID)
     * @throws Exception 온체인 전송 실패 시 예외 발생
     */
    String transfer(String toAddress, BigDecimal amount) throws Exception;

    /**
     * 특정 주소의 온체인 자산 잔고를 조회한다.
     *
     * @param address 조회 대상 지갑 주소
     * @return 온체인 잔고 수량
     */
    BigDecimal getBalance(String address);

    /**
     * 사용자별 고유한 가상자산 입금용 온체인 주소를 생성 및 발급한다.
     *
     * @return 생성 완료된 가상자산 지갑 주소
     * @throws Exception 주소 생성 실패 시 예외 발생
     */
    String generateAddress() throws Exception;

    /**
     * 온체인 트랜잭션 전송 시 예상되는 수수료(가스비 등)를 산정하여 반환한다.
     *
     * @param toAddress 수신 예정 지갑 주소
     * @param amount 송금 예정 수량
     * @return 예상 트랜잭션 수수료 수치
     * @throws Exception 수수료 산정 실패 시 예외 발생
     */
    BigDecimal estimateFee(String toAddress, BigDecimal amount) throws Exception;

    /**
     * 해당 코인 종류를 지원하는지 여부를 판단한다.
     *
     * @param currency 코인 기호 (예: JAF, BTC, ADA)
     * @return 지원 여부
     */
    boolean supports(String currency);

    /**
     * 블록체인 네트워크 노드와 정상적으로 초기화 연동이 완료되었는지 확인한다.
     *
     * @return 초기화 완료 여부
     */
    boolean isInitialized();

    /**
     * 해당 코인의 스마트 계약 주소를 조회한다. (스마트 계약 기반 자산일 경우 제공)
     *
     * @return 스마트 계약 주소 (CA)
     */
    String getContractAddress();
}
