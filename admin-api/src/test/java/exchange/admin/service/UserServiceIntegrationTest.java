package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.repository.UserRepository;
import exchange.admin.repository.WalletRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
class UserServiceIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WalletRepository walletRepository;

    @Test
    @Transactional
    @DisplayName("유저 지갑 자산 증감(입금/출금) 정합성 통합 테스트")
    void testAdjustAsset() {
        // 1. Given: 테스트 유저 생성
        User user = new User();
        user.setEmail("test_wallet@example.com");
        user.setPasswordHash("password_hash_dummy");
        user.setStatus("ACTIVE");
        user.setGrade(exchange.admin.model.constant.UserGrade.STANDARD);
        final User savedUser = userRepository.save(user);

        // 2. When: 10,000 KRW 입금 (Deposit)
        Wallet walletAfterDeposit = userService.adjustAsset(savedUser.getUserId(), "KRW", new BigDecimal("10000.0000"));

        // 3. Then: 10,000원이 정확히 들어갔는지 확인
        assertThat(walletAfterDeposit.getBalance()).isEqualByComparingTo(new BigDecimal("10000.0000"));

        // 4. When: 3,000 KRW 차감 (Withdraw)
        Wallet walletAfterWithdraw = userService.adjustAsset(savedUser.getUserId(), "KRW", new BigDecimal("-3000.0000"));

        // 5. Then: 7,000원이 남아야 함
        assertThat(walletAfterWithdraw.getBalance()).isEqualByComparingTo(new BigDecimal("7000.0000"));

        // 6. When: 잔고보다 큰 8,000원을 출금 시도 시 예외 발생해야 함
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            userService.adjustAsset(savedUser.getUserId(), "KRW", new BigDecimal("-8000.0000"));
        });
        
        // 에러 메시지 확인
        assertThat(exception.getMessage()).contains("Insufficient balance");
    }
}
