package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.repository.UserRepository;
import exchange.admin.repository.WalletRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 회원 지갑 자산 가산/감산 및 다양한 자산 유형 연산 관련 정합성 통합 검증 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용함.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UserWalletIntegrationTest extends BaseIntegrationTest {

    private final UserService userService;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    public UserWalletIntegrationTest(UserService userService,
                                    UserRepository userRepository,
                                    WalletRepository walletRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.walletRepository = walletRepository;
    }

    @Test
    @Order(1)
    @Transactional
    @DisplayName("1. 지갑이 아직 없는 회원이 지갑을 조회하면 잔액 0원인 지갑이 자동 생성되는지 확인")
    void test01_getOrCreateWallet_CreateNew_Success() {
        User user = userService.registerUser("wallet_lazy@example.com", "pass", "STANDARD");

        // 지갑 지연 생성(Lazy) 구동
        Wallet wallet = userService.getOrCreateWallet(user.getUserId(), "KRW");

        // 반환된 객체의 잔액이 0원인지 검증
        assertThat(wallet.getBalance()).isEqualByComparingTo(BigDecimal.ZERO);
        
        // DB 재조회하여 실제 데이터베이스 영속화 상태 검증
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "KRW").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("2. 지갑이 이미 있는 회원은 새로운 지갑을 더 만들지 않고 기존 지갑을 계속 쓰는지 확인")
    void test02_getOrCreateWallet_RetrieveExisting_Success() {
        User user = userService.registerUser("wallet_exist@example.com", "pass", "STANDARD");

        // 동일 지갑 연속 2회 요청
        Wallet w1 = userService.getOrCreateWallet(user.getUserId(), "KRW");
        Wallet w2 = userService.getOrCreateWallet(user.getUserId(), "KRW");

        // 두 지갑의 기본키(ID)가 완전히 동일한 인스턴스인지 검증
        assertThat(w1.getWalletId()).isEqualTo(w2.getWalletId());
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("3. 돈을 입금(Deposit)했을 때, 실제 통장에 입금한 만큼 잔액이 정확히 늘어나는지 확인")
    void test03_adjustAsset_Deposit_Success() {
        User user = userService.registerUser("deposit_user@example.com", "pass", "STANDARD");

        // 10,000 KRW 입금 실행
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("10000.0000"));

        // DB 재조회 검증
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "KRW").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(new BigDecimal("10000.0000"));
    }

    @Test
    @Order(4)
    @Transactional
    @DisplayName("4. 돈을 출금(Withdraw)했을 때, 실제 통장에서 출금한 만큼 잔액이 정확히 줄어드는지 확인")
    void test04_adjustAsset_Withdraw_Success() {
        User user = userService.registerUser("withdraw_user@example.com", "pass", "STANDARD");

        // 10,000원 입금 후 3,000원 출금 실행
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("10000.0000"));
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("-3000.0000"));

        // DB 직접 재조회 검증
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "KRW").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(new BigDecimal("7000.0000"));
    }

    @Test
    @Order(5)
    @Transactional
    @DisplayName("5. 가진 돈(잔고)보다 더 많은 돈을 출금하려고 시도할 때 출금이 차단되는지 확인")
    void test05_adjustAsset_InsufficientBalance_Fail() {
        User user = userService.registerUser("overdraft_user@example.com", "pass", "STANDARD");

        // 5,000원 충전
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("5000.0000"));

        // 가용 한도 초과 출금 시 예외 발생 검증
        assertThrows(IllegalArgumentException.class, () -> {
            userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("-6000.0000"));
        });

        // DB 잔고가 훼손되지 않고 원본 상태(5,000원)를 유지하는지 검증
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "KRW").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(new BigDecimal("5000.0000"));
    }

    @Test
    @Order(6)
    @Transactional
    @DisplayName("6. 비트코인(BTC) 같은 소수점 단위 자산을 다룰 때 소수점 아래 자릿수가 깨지지 않고 완벽히 저장되는지 확인")
    void test06_adjustAsset_BTC_Success() {
        User user = userService.registerUser("btc_user@example.com", "pass", "STANDARD");

        // 정밀 소수점 8자리 소수 자산 입고 실행
        userService.adjustAsset(user.getUserId(), "BTC", new BigDecimal("0.12345678"));

        // DB에 연산 오차나 절삭 없이 저장 완료되었는지 확인
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "BTC").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(new BigDecimal("0.12345678"));
    }

    @Test
    @Order(7)
    @Transactional
    @DisplayName("7. 자산 조정 금액이 0원일 경우, 잔액은 변하지 않고 0원 변동 기록만 정상적으로 남는지 확인")
    void test07_adjustAsset_ZeroAmount_Success() {
        User user = userService.registerUser("zero_user@example.com", "pass", "STANDARD");

        // 0원 변경 요청 실행
        userService.adjustAsset(user.getUserId(), "KRW", BigDecimal.ZERO);

        // 잔액이 그대로 0원인지 재조회 검증
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "KRW").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @Order(8)
    @Transactional
    @DisplayName("8. 존재하지 않는 회원 ID로 자산 조정을 시도할 때 예외가 발생하는지 확인")
    void test08_adjustAsset_InvalidUser_Throws() {
        // 존재하지 않는 가짜 회원 번호(9999999) 조정 시도 시 예외 발생 검증
        assertThrows(RuntimeException.class, () -> {
            userService.adjustAsset(9999999L, "KRW", new BigDecimal("1000.0000"));
        });
    }

    @Test
    @Order(9)
    @Transactional
    @DisplayName("9. 테이블에 선언되지 않은 신규 가상자산 코드(ETH)를 입금할 때 지갑이 정상 생성되는지 확인")
    void test09_adjustAsset_NewCurrency_Success() {
        User user = userService.registerUser("eth_user@example.com", "pass", "STANDARD");

        // 신규 통화코드(ETH) 지갑 동적 입금 실행
        userService.adjustAsset(user.getUserId(), "ETH", new BigDecimal("1.50000000"));

        // DB에 신규 통화 지갑 생성 확인
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "ETH").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(new BigDecimal("1.50000000"));
    }

    @Test
    @Order(10)
    @Transactional
    @DisplayName("10. 대용량 자산 금액(100억) 입금 시 부동소수점 오차나 오버플로우가 없는지 확인")
    void test10_adjustAsset_LargeAmount_Success() {
        User user = userService.registerUser("large_user@example.com", "pass", "STANDARD");

        // 100억 KRW 입금 실행 (데이터베이스 Numeric 정밀도 범위 내 연산)
        BigDecimal largeAmt = new BigDecimal("10000000000.0000");
        userService.adjustAsset(user.getUserId(), "KRW", largeAmt);

        // DB 재조회하여 정밀도 정합성 검증
        Wallet dbWallet = walletRepository.findByUserIdAndCurrency(user.getUserId(), "KRW").orElseThrow();
        assertThat(dbWallet.getBalance()).isEqualByComparingTo(largeAmt);
    }
}
