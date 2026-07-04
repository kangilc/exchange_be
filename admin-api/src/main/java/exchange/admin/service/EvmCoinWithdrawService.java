package exchange.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Set;

/**
 * EVM 테스트넷(Ganache)의 JAFTokenService를 사용하여 온체인 출금을 처리하는 서비스 구현체
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvmCoinWithdrawService implements CoinWithdrawService {

    private final JAFTokenService jafTokenService;

    // 실제 EVM 스마트 계약을 이용해 처리할 코인 목록 정의
    private static final Set<String> SUPPORTED_CURRENCIES = Set.of("JAF", "BTC", "ADA");

    @Override
    public String withdraw(String toAddress, BigDecimal amount) throws Exception {
        if (!jafTokenService.isInitialized()) {
            throw new IllegalStateException("JAFTokenService is not initialized yet.");
        }
        // JAFTokenService의 transfer 메소드를 호출하여 실제 온체인 상의 전송 트랜잭션을 실행
        log.info("[EVM 출금 실행] 수신주소: {}, 수량: {}", toAddress, amount);
        return jafTokenService.transfer(toAddress, amount);
    }

    @Override
    public boolean supports(String currency) {
        if (currency == null) {
            return false;
        }
        return SUPPORTED_CURRENCIES.contains(currency.toUpperCase());
    }
}
