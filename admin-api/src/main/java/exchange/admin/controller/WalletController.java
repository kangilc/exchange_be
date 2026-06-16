package exchange.admin.controller;

import exchange.admin.model.Wallet;
import exchange.admin.repository.WalletRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 어드민 자산 지갑 관리 컨트롤러.
 * 전체 지갑 조회, 특정 회원 지갑 조회, 통화별 유통 자산 요약 조회를 제공한다.
 */
@RestController
@RequestMapping("/admin/wallets")
@CrossOrigin(origins = "*")
public class WalletController {

    private final WalletRepository walletRepository;
    private final exchange.admin.repository.UserRepository userRepository;

    // 생성자 주입
    public WalletController(WalletRepository walletRepository, exchange.admin.repository.UserRepository userRepository) {
        this.walletRepository = walletRepository;
        this.userRepository = userRepository;
    }

    /**
     * 전체 회원 보유 지갑 목록 조회.
     * 
     * @return 지갑 리스트
     */
    @GetMapping
    public ResponseEntity<List<Wallet>> getAllWallets() {
        return ResponseEntity.ok(walletRepository.findAll());
    }

    /**
     * 특정 회원의 보유 지갑 목록 조회.
     * 
     * @param userId 회원 ID
     * @return 해당 회원의 지갑 리스트
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Wallet>> getWalletsByUserId(@PathVariable Long userId) {
        return ResponseEntity.ok(walletRepository.findByUserId(userId));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyWallets() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .map(user -> ResponseEntity.ok(walletRepository.findByUserId(user.getUserId())))
                .orElse(ResponseEntity.status(401).build());
    }

    /**
     * 통화별 총 유통 자산 및 주문 대기 락업 자산 요약 정보 조회.
     * 
     * @return 통화별 자산 요약 리스트
     */
    @GetMapping("/summary")
    public ResponseEntity<List<WalletRepository.CurrencySummary>> getWalletSummary() {
        return ResponseEntity.ok(walletRepository.getCurrencySummary());
    }
}

