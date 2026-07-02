package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.dto.response.AuthResponseODT;
import exchange.admin.exception.AuthException;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestConstructor;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 로그인 인증, 리프레시 토큰 회전(RTR) 및 보안 침해 차단 관련 정합성 통합 검증 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용함.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UserAuthIntegrationTest extends BaseIntegrationTest {

    private final AuthService authService;
    private final UserService userService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserAuthIntegrationTest(AuthService authService,
                                   UserService userService,
                                   UserRepository userRepository,
                                   PasswordEncoder passwordEncoder) {
        this.authService = authService;
        this.userService = userService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Test
    @Order(1)
    @Transactional
    @DisplayName("1. 올바른 자격 증명 입력 시 정상 로그인 성공 및 토큰 생성 검증")
    void test01_login_Success() {
        // 테스트 통제를 위한 격리용 회원가입 처리
        userService.registerUser("auth_success@example.com", "correct_pass", "STANDARD");

        // 로그인 실행
        AuthResponseODT response = authService.login("auth_success@example.com", "correct_pass");

        // 토큰 발급 여부 검증
        assertThat(response.getAccessToken()).isNotEmpty();
        assertThat(response.getRefreshToken()).isNotEmpty();
        assertThat(response.getEmail()).isEqualTo("auth_success@example.com");

        // 로그인 성공 시 발급된 Refresh Token이 사용자의 세션 식별 정보로서 데이터베이스의 테이블 컬럼에 정상 영속화되었는지 검증함.
        User dbUser = userRepository.findById(response.getUserId()).orElseThrow();
        assertThat(dbUser.getRefreshToken()).isEqualTo(response.getRefreshToken());
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("2. 잘못된 비밀번호 입력 시 로그인 차단 및 AuthException 예외 검증")
    void test02_login_WrongPassword_Throws() {
        userService.registerUser("auth_fail@example.com", "correct_pass", "STANDARD");

        // 가입 정보와 일치하지 않는 비정상적인 비밀번호로 로그인을 시도할 경우, 인증 실패 처리와 함께 AuthException이 상위로 던져지는지 검증함.
        assertThrows(AuthException.class, () -> {
            authService.login("auth_fail@example.com", "wrong_pass");
        });
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("3. 유효한 리프레시 토큰으로 신규 액세스/리프레시 토큰 발급 및 DB 토큰 회전(RTR) 성공 검증")
    void test03_refresh_RTR_Success() throws InterruptedException {
        userService.registerUser("auth_rtr@example.com", "correct_pass", "STANDARD");

        // 최초 로그인
        AuthResponseODT loginResp = authService.login("auth_rtr@example.com", "correct_pass");
        String oldRefreshToken = loginResp.getRefreshToken();

        // 발급되어 있던 기존 리프레시 토큰을 전달하여 RTR(Refresh Token Rotation) 토큰 회전 메커니즘을 구동함.
        AuthResponseODT refreshResp = authService.refresh(oldRefreshToken);

        // RTR 구동 결과 새로 반환받은 Access/Refresh Token 세트가 이전 발급 토큰 세트와 중복되지 않고 갱신되었는지 검증함.
        assertThat(refreshResp.getAccessToken()).isNotEqualTo(loginResp.getAccessToken());
        assertThat(refreshResp.getRefreshToken()).isNotEqualTo(oldRefreshToken);

        // 토큰 회전 결과 새로 발급된 신규 리프레시 토큰이 사용자의 DB 레코드에 업데이트되어 정상적으로 저장되었는지 검증함.
        User dbUser = userRepository.findById(loginResp.getUserId()).orElseThrow();
        assertThat(dbUser.getRefreshToken()).isEqualTo(refreshResp.getRefreshToken());
    }

    @Test
    @Order(4)
    @Transactional
    @DisplayName("4. 이미 1회 사용 완료되어 만료된 옛날 리프레시 토큰 재사용 갱신 시도 시 공격을 감지하고 차단하는지 검증")
    void test04_refresh_ReplayAttack_Throws() {
        userService.registerUser("auth_attack@example.com", "correct_pass", "STANDARD");

        // 최초 로그인
        AuthResponseODT loginResp = authService.login("auth_attack@example.com", "correct_pass");
        String usedRefreshToken = loginResp.getRefreshToken();

        // 최초 로그인으로 획득했던 리프레시 토큰을 사용하여 1차 토큰 갱신 작업을 정상 완료함.
        authService.refresh(usedRefreshToken);

        // 1차 갱신 완료로 인해 이미 사용 및 만료 처리된 구형 리프레시 토큰을 해커가 가로채어 재갱신(Replay Attack)을 시도할 때, DB 대조를 통해 공격을 탐지하고 차단하는지 검증함.
        assertThrows(AuthException.class, () -> {
            authService.refresh(usedRefreshToken);
        });
    }

    @Test
    @Order(5)
    @Transactional
    @DisplayName("5. 로그아웃 성공 시 DB 내 유저의 refreshToken 필드가 완전히 무효화(null)되는지 확인")
    void test05_logout_InvalidatesToken_Success() {
        userService.registerUser("auth_logout@example.com", "correct_pass", "STANDARD");

        // 로그인
        AuthResponseODT loginResp = authService.login("auth_logout@example.com", "correct_pass");
        
        // 로그아웃 실행
        authService.logout("auth_logout@example.com");

        // 로그아웃 메서드 호출 결과, 사용자의 DB 레코드 내 리프레시 토큰 필드 데이터가 안전하게 비워져(null) 토큰이 정상적으로 무효화되었는지 검증함.
        User dbUser = userRepository.findById(loginResp.getUserId()).orElseThrow();
        assertThat(dbUser.getRefreshToken()).isNull();
    }

    @Test
    @Order(6)
    @Transactional
    @DisplayName("6. 존재하지 않는 사용자 이메일로 로그인 시도 시 예외 발생 검증")
    void test06_login_UserNotFound_Throws() {
        // 등록되지 않은 이메일 주소로 로그인 시도를 수행함.
        // AuthService가 가입 정보를 조회한 후 결과가 존재하지 않아 AuthException을 적절히 반환하는지 검증함.
        assertThrows(AuthException.class, () -> {
            authService.login("non_existent_user@example.com", "any_password");
        });
    }

    @Test
    @Order(7)
    @Transactional
    @DisplayName("7. 비어있거나(null) 공백인 리프레시 토큰으로 갱신 시도 시 예외 발생 검증")
    void test07_refresh_EmptyToken_Throws() {
        // 인자값이 null이거나 빈 문자열, 혹은 공백으로만 이루어진 토큰을 갱신 메서드에 전달하여 예외를 발생시키는지 검증함.
        // 유효하지 않은 요청에 대해 비즈니스 로직 단에서 사전에 필터링하는 방어적 로직의 동작 정합성을 확인함.
        assertThrows(AuthException.class, () -> {
            authService.refresh(null);
        });
        assertThrows(AuthException.class, () -> {
            authService.refresh("   ");
        });
    }

    @Test
    @Order(8)
    @Transactional
    @DisplayName("8. 위조되거나 유효하지 않은 리프레시 토큰으로 갱신 시도 시 예외 발생 검증")
    void test08_refresh_InvalidToken_Throws() {
        // 임의로 위조되었거나 유효성 형식을 만족하지 못하는 문자열을 리프레시 토큰으로 전달하여 갱신을 시도함.
        // tokenProvider.validateToken() 검증 과정을 통해 비정상 토큰임이 감지되어 최종적으로 AuthException이 터지는지 확인함.
        assertThrows(AuthException.class, () -> {
            authService.refresh("completely_fake_invalid_token_value_xyz123");
        });
    }

    @Test
    @Order(9)
    @Transactional
    @DisplayName("9. 존재하지 않는 사용자 이메일로 로그아웃 시도 시 예외 없이 무시(Silent)되는지 검증")
    void test09_logout_NonExistentUser_SilentlyIgnores() {
        // 가입되지 않은 이메일 주소 정보로 로그아웃 메서드를 직접 호출함.
        // 내부 조회 결과 유저 데이터가 없더라도 NullPointerException이나 기타 런타임 예외가 전파되지 않고 내부적으로 안전하게 무시 처리가 완료되는지 검증함.
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> {
            authService.logout("no_such_user_email_exists@example.com");
        });
    }
}
