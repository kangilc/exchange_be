package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.model.User;
import exchange.admin.model.constant.UserGrade;
import exchange.admin.repository.UserRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 회원 계정 생성, 정보 갱신, 회원 검색 관련 정합성 통합 검증 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용함.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UserAccountIntegrationTest extends BaseIntegrationTest {

    private final UserService userService;
    private final UserRepository userRepository;

    public UserAccountIntegrationTest(UserService userService, UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @Test
    @Order(1)
    @Transactional
    @DisplayName("1. 새로운 이메일로 정상적으로 회원가입이 완료되는지 확인")
    void test01_registerUser_Success() {
        // 회원 가입 실행
        User user = userService.registerUser("new_test@example.com", "raw_password", "STANDARD");

        // DB 직접 조회 및 검증
        User dbUser = userRepository.findById(user.getUserId()).orElseThrow();
        assertThat(dbUser.getEmail()).isEqualTo("new_test@example.com");
        assertThat(dbUser.getGrade()).isEqualTo(UserGrade.STANDARD);
        assertThat(dbUser.getPasswordHash()).isNotEqualTo("raw_password"); // 암호화 확인
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("2. 이미 가입된 이메일로 다시 가입을 시도할 때 가입이 막히는지 확인")
    void test02_registerUser_DuplicateEmail_Fail() {
        // 첫 번째 가입
        userService.registerUser("dup_test@example.com", "pass123", "STANDARD");

        // 두 번째 동일 메일 가입 시 비즈니스 오류 예외(IllegalArgumentException) 발생 검증
        assertThrows(IllegalArgumentException.class, () -> {
            userService.registerUser("dup_test@example.com", "pass456", "STANDARD");
        });
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("3. 회원의 등급(STANDARD ➡️ VIP)이나 상태가 정상적으로 수정되는지 확인")
    void test03_updateUser_Success() {
        User user = userService.registerUser("update_test@example.com", "pass", "STANDARD");

        // 상태 및 등급 변경 실행
        userService.updateUser(user.getUserId(), null, "INACTIVE", "VIP");

        // DB 재조회하여 값 반영 검증
        User dbUser = userRepository.findById(user.getUserId()).orElseThrow();
        assertThat(dbUser.getStatus()).isEqualTo("INACTIVE");
        assertThat(dbUser.getGrade()).isEqualTo(UserGrade.VIP);
    }

    @Test
    @Order(4)
    @Transactional
    @DisplayName("4. 여러 명의 회원을 가입시켰을 때 전체 회원 조회가 정상작동하는지 확인")
    void test04_getAllUsers_Success() {
        // 회원 2명 신규 생성
        userService.registerUser("user_a@example.com", "pass", "STANDARD");
        userService.registerUser("user_b@example.com", "pass", "STANDARD");

        // 전체 조회 실행
        List<User> list = userService.getAllUsers();

        // 등록한 회원이 포함되어 있는지 검증
        assertThat(list).anyMatch(u -> u.getEmail().equals("user_a@example.com"));
        assertThat(list).anyMatch(u -> u.getEmail().equals("user_b@example.com"));
    }

    @Test
    @Order(5)
    @Transactional
    @DisplayName("5. 회원의 고유 ID(Sequence)로 특정 회원이 올바르게 조회되는지 확인")
    void test05_getUserById_Success() {
        User user = userService.registerUser("find_by_id@example.com", "pass", "STANDARD");

        // ID 기준 개별 조회 실행
        User dbUser = userService.getUserById(user.getUserId()).orElseThrow();

        assertThat(dbUser.getEmail()).isEqualTo("find_by_id@example.com");
    }

    @Test
    @Order(6)
    @Transactional
    @DisplayName("6. 존재하지 않는 회원 ID를 조회할 때 결과가 비어있는지 확인")
    void test06_getUserById_NotFound() {
        // 비존재 ID(99999999) 조회 실행
        Optional<User> result = userService.getUserById(99999999L);

        // 결과가 존재하지 않는 것을 검증
        assertThat(result).isEmpty();
    }

    @Test
    @Order(7)
    @Transactional
    @DisplayName("7. 회원의 이메일 주소로 특정 회원이 올바르게 조회되는지 확인")
    void test07_getUserByEmail_Success() {
        userService.registerUser("find_by_email@example.com", "pass", "STANDARD");

        // 이메일 기준 조회 실행
        User dbUser = userService.getUserByEmail("find_by_email@example.com").orElseThrow();

        assertThat(dbUser.getEmail()).isEqualTo("find_by_email@example.com");
    }

    @Test
    @Order(8)
    @Transactional
    @DisplayName("8. 존재하지 않는 회원 이메일로 조회할 때 결과가 비어있는지 확인")
    void test08_getUserByEmail_NotFound() {
        // 비존재 이메일 조회 실행
        Optional<User> result = userService.getUserByEmail("not_exist_email@example.com");

        // 결과가 비어있음을 검증
        assertThat(result).isEmpty();
    }

    @Test
    @Order(9)
    @DisplayName("9. 회원가입 완료 시 비동기(Kafka)를 통해 Elasticsearch 색인이 트리거되는지 검증")
    void test09_registerUser_TriggersKafkaAndEsSync() throws Exception {
        // Given
        String testEmail = "kafka_sync_verify@example.com";
        org.mockito.Mockito.reset(userSearchRepository);

        // When
        // 메서드 자체에 @Transactional이 부여되지 않아 즉시 커밋 완료되며 AFTER_COMMIT 리스너 및 Kafka 발행이 작동함
        User user = userService.registerUser(testEmail, "pass123", "STANDARD");

        try {
            // Then: Kafka 메시지 전송 및 Consumer 백그라운드 처리를 위한 대기
            Thread.sleep(1200);

            // ES Mock 리포지토리에 DTO 정보가 정상 가공되어 save() 호출되었는지 확인
            org.mockito.Mockito.verify(userSearchRepository, org.mockito.Mockito.atLeastOnce())
                    .save(org.mockito.Mockito.argThat(doc -> doc.getEmail().equals(testEmail)));
        } finally {
            // 테스트로 생성된 가입 데이터 수동 클린업
            userRepository.deleteById(user.getUserId());
        }
    }
}
