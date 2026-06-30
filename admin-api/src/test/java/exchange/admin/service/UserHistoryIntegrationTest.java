package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.dto.request.common.DateRangePageIDT;
import exchange.admin.dto.response.DetailedLedgerODT;
import exchange.admin.dto.response.UserTradeODT;
import exchange.admin.model.LedgerJournal;
import exchange.admin.model.User;
import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.UserRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 분개장 감사 변동 로그 적재 및 MyBatis 연동 다중조인 페이징 조회 정합성 검증 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용함.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UserHistoryIntegrationTest extends BaseIntegrationTest {

    private final UserService userService;
    private final UserRepository userRepository;
    private final LedgerJournalRepository ledgerJournalRepository;

    public UserHistoryIntegrationTest(UserService userService,
                                      UserRepository userRepository,
                                      LedgerJournalRepository ledgerJournalRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.ledgerJournalRepository = ledgerJournalRepository;
    }

    @Test
    @Order(1)
    @Transactional
    @DisplayName("1. 돈을 입금했을 때, 나중에 확인을 위한 입금 이력(감사 로그)이 DB에 올바르게 남는지 확인")
    void test01_adjustAsset_Deposit_WriteLedger_Success() {
        User user = userService.registerUser("ledger_dep@example.com", "pass", "STANDARD");

        // 15,000 KRW 입금 실행
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("15000.0000"));

        // DB 분개장 테이블에서 직접 조회 및 변동 로그 검증
        List<LedgerJournal> logs = ledgerJournalRepository.findAll();
        assertThat(logs).hasSize(1);
        
        LedgerJournal log = logs.get(0);
        assertThat(log.getUserId()).isEqualTo(user.getUserId());
        assertThat(log.getAmount()).isEqualByComparingTo(new BigDecimal("15000.0000"));
        assertThat(log.getType()).isEqualTo("DEPOSIT");
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("2. 돈을 출금했을 때, 나중에 확인을 위한 출금 이력(감사 로그)이 DB에 올바르게 남는지 확인")
    void test02_adjustAsset_Withdraw_WriteLedger_Success() {
        User user = userService.registerUser("ledger_with@example.com", "pass", "STANDARD");

        // 입출금 실행
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("20000.0000"));
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("-5000.0000"));

        // DB 감사 로그 목록 적재 확인
        List<LedgerJournal> logs = ledgerJournalRepository.findAll();
        assertThat(logs).hasSize(2);
        
        LedgerJournal withdrawLog = logs.stream()
                .filter(l -> l.getType().equals("WITHDRAWAL"))
                .findFirst()
                .orElseThrow();
        assertThat(withdrawLog.getAmount()).isEqualByComparingTo(new BigDecimal("-5000.0000"));
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("3. 돈을 입출금한 후, MyBatis 매퍼를 연동하여 원장 상세 목록이 날짜별로 정렬 및 페이징 조회되는지 확인")
    void test03_getUserLedgers_Success() {
        User user = userService.registerUser("ledger_query@example.com", "pass", "STANDARD");

        // 입출금 변동 이력 2건 발생
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("10000.0000"));
        userService.adjustAsset(user.getUserId(), "KRW", new BigDecimal("-2000.0000"));

        // MyBatis 페이징 및 필터 객체 정의 (최근 7일 범위)
        DateRangePageIDT idt = new DateRangePageIDT();
        idt.setPage(0);
        idt.setSize(10);
        idt.setStartDate(LocalDateTime.now().minusDays(7));
        idt.setEndDate(LocalDateTime.now().plusDays(1));

        // MyBatis Mapper 연동을 통한 조회 서비스 실행
        Page<DetailedLedgerODT> page = userService.getUserLedgers(user.getUserId(), idt);

        // 페이징 카운트 및 DB 직접 연동 검증
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent().get(0).getAmount()).isNotNull();
    }

    @Test
    @Order(4)
    @Transactional
    @DisplayName("4. 체결(거래) 내역이 전혀 없는 신규 회원 조회 시, MyBatis 매퍼 연동 후 빈 목록이 안전하게 반환되는지 확인")
    void test04_getUserTrades_Empty() {
        User user = userService.registerUser("trade_empty@example.com", "pass", "STANDARD");

        // 페이징 DTO 설정
        DateRangePageIDT idt = new DateRangePageIDT();
        idt.setPage(0);
        idt.setSize(10);

        // MyBatis Mapper 연동을 통한 거래 조회 실행
        Page<UserTradeODT> page = userService.getUserTrades(user.getUserId(), idt);

        // 결과가 비어있는지 검증
        assertThat(page.getTotalElements()).isZero();
        assertThat(page.getContent()).isEmpty();
    }
}
