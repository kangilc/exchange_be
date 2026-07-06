package exchange.admin.controller;

import exchange.admin.dto.ApiResponse;
import exchange.admin.dto.request.common.BasePageIDT;
import exchange.admin.dto.request.common.DateRangePageIDT;
import exchange.admin.dto.request.user.AssetAdjustIDT;
import exchange.admin.dto.request.user.UserRegisterIDT;
import exchange.admin.dto.request.user.UserUpdateIDT;
import exchange.admin.dto.response.DetailedLedgerODT;
import exchange.admin.dto.response.UserTradeODT;
import exchange.admin.dto.response.UserODT;
import exchange.admin.dto.response.WalletODT;
import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

/**
 * 어드민 회원 관리 컨트롤러.
 * 회원 등록, 정보 수정, 회원별 체결 및 원장 변경 이력 조회, 자산 수동 조정 기능을 제공한다.
 */
@RestController
@RequestMapping("/admin/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    // 생성자 주입
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 회원 목록 조회. 페이징 파라미터가 지정되면 페이징 객체를 반환하고, 없으면 전체 리스트를 반환함.
     * 
     * @param page 페이지 번호 (0-based)
     * @param size 페이지당 개수
     * @return 회원 목록 데이터
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Object>> getAllUsers(
            @RequestParam(name = "page", defaultValue = "0") Integer page,
            @RequestParam(name = "size", defaultValue = "10") Integer size) {
        Page<User> userPage = userService.getAllUsers(PageRequest.of(page, size));
        Page<UserODT> odtPage = userPage.map(UserODT::new);
        return ApiResponse.<Object>ok(odtPage);
    }

    /**
     * 특정 회원의 정보 조회.
     * 
     * @param id 회원 ID
     * @return 회원 정보 데이터
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UserODT>> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(user -> ApiResponse.ok(new UserODT(user)))
                .orElse(ApiResponse.notFound("User not found"));
    }

    /**
     * 신규 회원 가입 및 계정 개설.
     * E2E 테스트용 경로(/register)와 대시보드 등록 경로(/) 두 매핑을 동시에 수용합니다.
     * 
     * @param request 가입 요청 데이터 (email, password, grade, role)
     * @return 가입 완료된 회원 정보
     */
    @PostMapping(value = { "", "/register" })
    public ResponseEntity<ApiResponse<UserODT>> registerUser(@Valid @RequestBody UserRegisterIDT request) {
        User registeredUser = userService.registerUser(request.getEmail(), request.getPassword(), request.getGrade(),
                request.getRole());
        return ApiResponse.ok(new UserODT(registeredUser));
    }

    /**
     * 회원 정보(이메일, 계정 상태, 보안 등급 및 권한 역할 등) 수정.
     * 
     * @param id      회원 ID
     * @param request 수정 요청 데이터 (email, status, grade, role)
     * @return 수정된 회원 정보
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UserODT>> updateUser(@PathVariable Long id,
            @Valid @RequestBody UserUpdateIDT request) {
        return userService
                .updateUser(id, request.getEmail(), request.getStatus(), request.getGrade(), request.getRole())
                .map(user -> ApiResponse.ok(new UserODT(user)))
                .orElse(ApiResponse.notFound("User not found"));
    }

    /**
     * 특정 회원의 자산 수동 조정 (입출금 강제 조작).
     * 
     * @param id      회원 ID
     * @param request 조정할 통화 종류(currency) 및 액수(amount)
     * @return 갱신된 회원 지갑 정보
     */
    @PostMapping("/{id}/assets/adjust")
    public ResponseEntity<ApiResponse<WalletODT>> adjustAsset(@PathVariable Long id,
            @Valid @RequestBody AssetAdjustIDT request) {
        try {
            Wallet updatedWallet = userService.adjustAsset(id, request.getCurrency(), request.getAmount());
            return ApiResponse.ok(new WalletODT(updatedWallet));
        } catch (IllegalArgumentException e) {
            return ApiResponse.badRequest(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.internalServerError("Error: " + e.getMessage());
        }
    }

    /**
     * 특정 회원의 거래 체결 내역 조회.
     * 
     * @param id  회원 ID
     * @param idt 조회할 페이지 번호 및 사이즈 등 공통 IDT
     * @return 체결 정보 페이징 객체
     */
    @GetMapping("/{id}/trades")
    public ResponseEntity<ApiResponse<Page<UserTradeODT>>> getUserTrades(
            @PathVariable Long id,
            @ModelAttribute DateRangePageIDT idt) {

        Page<UserTradeODT> pageResult = userService.getUserTrades(id, idt);
        return ApiResponse.ok(pageResult);
    }

    /**
     * 특정 회원의 상세 원장 변동 내역 조회.
     * 
     * @param id  회원 ID
     * @param idt 페이징 및 날짜 검색 파라미터
     * @return 자산 변동 상세 내역 페이징 객체
     */
    @GetMapping("/{id}/ledgers")
    public ResponseEntity<ApiResponse<Page<DetailedLedgerODT>>> getUserLedgers(
            @PathVariable Long id,
            @ModelAttribute DateRangePageIDT idt) {

        Page<DetailedLedgerODT> pageResult = userService.getUserLedgers(id, idt);
        return ApiResponse.ok(pageResult);
    }

    /**
     * 로그인된 회원 본인의 거래 체결 내역 조회.
     * SecurityContextHolder의 인증정보를 기반으로 본인의 체결 데이터만 필터링하여 반환합니다.
     * 
     * @param idt 페이징 파라미터
     * @return 체결 정보 페이징 객체 또는 401 Unauthorized
     */
    @GetMapping("/me/trades")
    public ResponseEntity<ApiResponse<Page<UserTradeODT>>> getMyTrades(
            @ModelAttribute DateRangePageIDT idt) {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()
                .getName();
        Optional<User> userOpt = userService.getUserByEmail(email);
        if (userOpt.isPresent()) {
            Long userId = userOpt.get().getUserId();
            Page<UserTradeODT> pageResult = userService.getUserTrades(userId, idt);
            return ApiResponse.ok(pageResult);
        }
        return ApiResponse.unauthorized("Unauthorized");
    }

    /**
     * 로그인된 회원 본인의 상세 원장 변동 내역 조회.
     * SecurityContextHolder의 인증정보를 기반으로 본인의 원장 정보만 필터링하여 반환합니다.
     * 
     * @param idt 페이징 및 날짜 검색 파라미터
     * @return 원장 정보 페이징 객체 또는 401 Unauthorized
     */
    @GetMapping("/me/ledgers")
    public ResponseEntity<ApiResponse<Page<DetailedLedgerODT>>> getMyLedgers(
            @ModelAttribute DateRangePageIDT idt) {

        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication()
                .getName();
        Optional<User> userOpt = userService.getUserByEmail(email);

        if (userOpt.isPresent()) {
            Long userId = userOpt.get().getUserId();
            Page<DetailedLedgerODT> pageResult = userService.getUserLedgers(userId, idt);
            return ApiResponse.ok(pageResult);
        }
        return ApiResponse.unauthorized("Unauthorized");
    }
}
