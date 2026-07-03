package exchange.admin.controller;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.dto.response.AuthResponseODT;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import exchange.admin.service.AuthService;
import exchange.admin.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * UserController의 인가 제어, 사용자 상태 변경(가입 승인) 및 자산 조정을 검증하는 슬라이스 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용하고 한글 평어체 주석을 추가함.
 */
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class UserControllerTest extends BaseIntegrationTest {

    private final MockMvc mockMvc;
    private final UserService userService;
    private final AuthService authService;
    private final UserRepository userRepository;
    private final jakarta.persistence.EntityManager entityManager;

    private String adminToken;
    private String userToken;

    public UserControllerTest(MockMvc mockMvc, UserService userService, AuthService authService, UserRepository userRepository, jakarta.persistence.EntityManager entityManager) {
        this.mockMvc = mockMvc;
        this.userService = userService;
        this.authService = authService;
        this.userRepository = userRepository;
        this.entityManager = entityManager;
    }

    @BeforeEach
    void setUp() {
        // 테스트용 관리자 및 일반 사용자 계정 사전 등록하고 토큰 발급받음
        if (userRepository.findByEmail("admin_test@javaf.net").isEmpty()) {
            userService.registerUser("admin_test@javaf.net", "adminpass123", "VIP", "ADMIN");
        }
        if (userRepository.findByEmail("user_test@javaf.net").isEmpty()) {
            userService.registerUser("user_test@javaf.net", "userpass123", "STANDARD", "USER");
        }

        AuthResponseODT adminAuth = authService.login("admin_test@javaf.net", "adminpass123");
        adminToken = adminAuth.getAccessToken();

        AuthResponseODT userAuth = authService.login("user_test@javaf.net", "userpass123");
        userToken = userAuth.getAccessToken();
    }

    @Test
    @Transactional
    @DisplayName("1. 회원 목록 조회 권한 검증 - ADMIN 권한인 경우 성공(200)")
    void test01_getAllUsers_Admin_Success() throws Exception {
        // ADMIN 토큰을 첨부하여 요청함
        mockMvc.perform(get("/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @Transactional
    @DisplayName("2. 회원 목록 조회 권한 검증 - 일반 USER 권한인 경우 실패(403) 및 공통 에러 응답 규격 검증")
    void test02_getAllUsers_User_Forbidden() throws Exception {
        // 일반 USER 토큰을 첨부하여 요청함
        mockMvc.perform(get("/admin/users")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden()) // 403 Forbidden 발생 검증함
                .andExpect(jsonPath("$.status").value(403)) // 공통 에러 규격 HTTP 상태코드 검증함
                .andExpect(jsonPath("$.success").value(false)) // 공통 에러 규격 성공 여부 검증함
                .andExpect(jsonPath("$.message").value("해당 리소스에 접근할 권한이 없습니다.")); // 권한 차단 메시지 검증함
    }

    @Test
    @Transactional
    @DisplayName("3. 회원 가입 승인 검증 - 어드민 권한으로 PENDING 계정을 ACTIVE로 승인 시 수정자 반영 검증")
    void test03_approveUser_Success() throws Exception {
        // 1단계: 공개 회원가입을 통해 PENDING 유저 생성함
        User pendingUser = authService.signup("e2e_pending@javaf.net", "pass12345");
        assertThat(pendingUser.getStatus()).isEqualTo("PENDING");

        // 2단계: 어드민 권한으로 가입 승인(ACTIVE) API 요청함
        String requestBody = "{\"email\":\"e2e_pending@javaf.net\",\"status\":\"ACTIVE\",\"grade\":\"STANDARD\",\"role\":\"USER\"}";

        mockMvc.perform(put("/admin/users/" + pendingUser.getUserId())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        // 테스트 스레드에 임시로 어드민 인증 정보 주입함 (MockMvc 종료 후 flush 시점에 AuditorAware가 감지하도록 처리함)
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
            new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                "admin_test@javaf.net", null,
                java.util.Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))
            )
        );

        // 영속성 컨텍스트 강제 플러시 및 초기화 처리함 (@PreUpdate 이벤트 강제 구동 및 캐시 비움)
        entityManager.flush();
        entityManager.clear();

        // 사용한 임시 인증 컨텍스트 정보 초기화함
        org.springframework.security.core.context.SecurityContextHolder.clearContext();

        // 3단계: DB에 반영된 수정자(updated_by)가 어드민 계정으로 올바르게 기록되었는지 최종 검증함
        User updatedUser = userRepository.findById(pendingUser.getUserId()).orElseThrow();
        assertThat(updatedUser.getStatus()).isEqualTo("ACTIVE");
        assertThat(updatedUser.getUpdatedBy()).isEqualTo("admin_test@javaf.net"); // 수정자 일치 검증함
    }

    @Test
    @Transactional
    @DisplayName("4. 자산 수동 조정 검증 - 음수 금액 입력 시 유효성 검사 실패(400)")
    void test04_adjustAsset_NegativeAmount_Fail() throws Exception {
        User targetUser = userRepository.findByEmail("user_test@javaf.net").orElseThrow();

        // 음수 금액으로 자산 조정 요청함 (Validation 오류 유도)
        String requestBody = "{\"currency\":\"KRW\",\"amount\":-50000}";

        mockMvc.perform(post("/admin/users/" + targetUser.getUserId() + "/assets/adjust")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest()); // 400 Bad Request 발생 검증함
    }

    @Test
    @Transactional
    @DisplayName("5. 인증 누락 검증 - 토큰 없이 ADMIN 경로 요청 시 401 Unauthorized 및 규격화된 에러 JSON 반환")
    void test05_unauthorizedRequest_Fail() throws Exception {
        // 토큰 없이 회원 목록 조회 요청함
        mockMvc.perform(get("/admin/users"))
                .andExpect(status().isUnauthorized()) // 401 상태코드 반환 검증함
                .andExpect(jsonPath("$.status").value(401)) // 공통 규격 HTTP 상태코드 검증함
                .andExpect(jsonPath("$.success").value(false)) // 공통 규격 성공 여부 검증함
                .andExpect(jsonPath("$.message").value("인증 토큰이 누락되었거나 유효하지 않습니다.")); // 공통 에러 메시지 검증함
    }
}
