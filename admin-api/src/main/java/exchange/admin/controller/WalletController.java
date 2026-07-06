package exchange.admin.controller;

import exchange.admin.dto.ApiResponse;
import exchange.admin.dto.response.WalletODT;
import exchange.admin.model.Wallet;
import exchange.admin.repository.WalletRepository;
import exchange.admin.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 어드민 자산 지갑 관리 컨트롤러.
 * 전체 지갑 조회, 특정 회원 지갑 조회, 통화별 유통 자산 요약 조회를 제공한다.
 */
@RestController
@RequestMapping("/admin/wallets")
@CrossOrigin(origins = "*")
public class WalletController {

    private final WalletRepository walletRepository;
    private final UserRepository userRepository;

    // 수동 생성자 주입 방식 적용 (Autowired 금지 규칙)
    public WalletController(WalletRepository walletRepository, UserRepository userRepository) {
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
    }

    /**
     * 전체 회원 보유 지갑 목록 페이징 조회.
     * 
     * @param pageable 페이징 정보
     * @return 지갑 목록 페이징 데이터
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<WalletODT>>> getAllWallets(@PageableDefault(size = 10) Pageable pageable) {
        Page<Wallet> wallets = walletRepository.findAll(pageable);
        return ApiResponse.ok(wallets.map(WalletODT::new));
    }

    /**
     * 특정 회원의 보유 지갑 목록 조회.
     * 
     * @param userId 회원 ID
     * @return 해당 회원의 지갑 리스트
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<WalletODT>>> getWalletsByUserId(@PathVariable Long userId) {
        List<Wallet> wallets = walletRepository.findByUserId(userId);
        List<WalletODT> odtList = wallets.stream().map(WalletODT::new).collect(Collectors.toList());
        return ApiResponse.ok(odtList);
    }

    /**
     * 로그인된 회원 본인의 지갑 목록 조회.
     * SecurityContextHolder의 인증정보(이메일)를 기반으로 회원 식별 후 지갑 목록을 반환합니다.
     * 
     * @return 지갑 리스트 또는 401 Unauthorized
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<WalletODT>>> getMyWallets() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        java.util.Optional<exchange.admin.model.User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            List<Wallet> wallets = walletRepository.findByUserId(userOpt.get().getUserId());
            List<WalletODT> odtList = wallets.stream().map(WalletODT::new).collect(Collectors.toList());
            return ApiResponse.ok(odtList);
        }
        return ApiResponse.unauthorized("Unauthorized");
    }

    /**
     * 통화별 총 유통 자산 및 주문 대기 락업 자산 요약 정보 조회.
     * 
     * @return 통화별 자산 요약 리스트
     */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<List<WalletRepository.CurrencySummary>>> getWalletSummary() {
        return ApiResponse.ok(walletRepository.getCurrencySummary());
    }
}

