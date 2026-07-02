package exchange.admin.controller;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.model.User;
import exchange.admin.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AuthController의 회원가입 신청 및 로그인 처리 흐름을 검증하는 슬라이스 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용하고 한글 평어체 주석을 추가함.
 */
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class AuthControllerTest extends BaseIntegrationTest {

    private final MockMvc mockMvc;
    private final UserRepository userRepository;

    public AuthControllerTest(MockMvc mockMvc, UserRepository userRepository) {
        this.mockMvc = mockMvc;
        this.userRepository = userRepository;
    }

    @Test
    @Transactional
    @DisplayName("1. 회원가입 신청 성공 검증 - 올바른 형식의 가입 시 PENDING 상태 회원 생성됨")
    void test01_signup_Success() throws Exception {
        // 올바른 이메일과 비밀번호 규격으로 회원가입 요청 전송함
        String requestBody = "{\"email\":\"new_signup@example.com\",\"password\":\"pass12345\"}";

        mockMvc.perform(post("/admin/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("new_signup@example.com"))
                .andExpect(jsonPath("$.data.status").value("PENDING")); // 회원가입 직후 PENDING 상태 검증함
    }

    @Test
    @Transactional
    @DisplayName("2. 회원가입 신청 실패 검증 - 이메일 형식 오류 시 400 Bad Request 반환")
    void test02_signup_Fail_InvalidEmail() throws Exception {
        // 비정상적인 이메일 형식으로 회원가입 요청함
        String requestBody = "{\"email\":\"invalid-email-format\",\"password\":\"pass12345\"}";

        mockMvc.perform(post("/admin/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest()); // 유효성 검증 실패(400) 검증함
    }

    @Test
    @Transactional
    @DisplayName("3. 회원가입 신청 실패 검증 - 중복된 이메일 존재 시 400 Bad Request 반환")
    void test03_signup_Fail_DuplicateEmail() throws Exception {
        // 동일한 이메일을 가진 활성 유저 사전 등록 처리함
        User user = new User();
        user.setEmail("duplicate@example.com");
        user.setPasswordHash("hashed_password");
        user.setStatus("ACTIVE");
        userRepository.save(user);

        // 동일 이메일로 가입 요청하여 중복 방지 로직 실행함
        String requestBody = "{\"email\":\"duplicate@example.com\",\"password\":\"pass12345\"}";

        mockMvc.perform(post("/admin/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("이미 가입된 이메일 주소입니다.")); // 중복 예외 메시지 검증함
    }
}
