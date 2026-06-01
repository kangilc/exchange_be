package exchange.admin.controller;

import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 어드민 회원 관리 컨트롤러.
 * 회원 등록, 정보 수정, 회원별 체결 및 원장 변경 이력 조회, 자산 수동 조정 기능을 제공한다.
 */
@RestController
@RequestMapping("/admin/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final exchange.admin.repository.TradeRepository tradeRepository;
    private final exchange.admin.repository.LedgerJournalRepository ledgerJournalRepository;

    // 생성자 주입
    public UserController(
            UserService userService,
            exchange.admin.repository.TradeRepository tradeRepository,
            exchange.admin.repository.LedgerJournalRepository ledgerJournalRepository) {
        this.userService = userService;
        this.tradeRepository = tradeRepository;
        this.ledgerJournalRepository = ledgerJournalRepository;
    }

    /**
     * 전체 회원 목록 조회.
     * 
     * @return 전체 회원 리스트
     */
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    /**
     * 특정 회원의 정보 조회.
     * 
     * @param id 회원 ID
     * @return 회원 정보 데이터
     */
    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 신규 회원 가입 및 계정 개설.
     * 가입 처리 완료 후 기본 거래 자산 지갑이 자동으로 생성된다.
     * 
     * @param request 가입 요청 데이터 (email, password, grade)
     * @return 가입 완료된 회원 정보
     */
    @PostMapping
    public ResponseEntity<User> registerUser(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String password = request.get("password");
        String grade = request.get("grade");
        
        if (email == null || password == null) {
            return ResponseEntity.badRequest().build();
        }
        
        User registeredUser = userService.registerUser(email, password, grade);
        return ResponseEntity.ok(registeredUser);
    }

    /**
     * 회원 정보(이메일, 계정 상태, 보안 등급 등) 수정.
     * 
     * @param id      회원 ID
     * @param request 수정 요청 데이터 (email, status, grade)
     * @return 수정된 회원 정보
     */
    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String email = request.get("email");
        String status = request.get("status");
        String grade = request.get("grade");
        
        return userService.updateUser(id, email, status, grade)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 특정 회원의 자산 수동 조정 (입출금 강제 조작).
     * 
     * @param id      회원 ID
     * @param request 조정할 통화 종류(currency) 및 액수(amount)
     * @return 갱신된 회원 지갑 정보
     */
    @PostMapping("/{id}/assets/adjust")
    public ResponseEntity<?> adjustAsset(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String currency = (String) request.get("currency");
        Object amountObj = request.get("amount");
        
        if (currency == null || amountObj == null) {
            return ResponseEntity.badRequest().body("Required fields: 'currency' and 'amount'");
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(amountObj.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid amount format");
        }

        try {
            Wallet updatedWallet = userService.adjustAsset(id, currency, amount);
            return ResponseEntity.ok(updatedWallet);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    /**
     * 특정 회원의 거래 체결 내역 조회.
     * 
     * @param id   회원 ID
     * @param page 조회할 페이지 번호
     * @param size 페이지당 목록 수
     * @return 체결 정보 페이징 객체
     */
    @GetMapping("/{id}/trades")
    public ResponseEntity<org.springframework.data.domain.Page<exchange.admin.repository.TradeRepository.UserTradeProjection>> getUserTrades(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(tradeRepository.findUserTrades(id, org.springframework.data.domain.PageRequest.of(page, size)));
    }

    /**
     * 특정 회원의 상세 원장 변동 내역 조회.
     * 
     * @param id   회원 ID
     * @param page 조회할 페이지 번호
     * @param size 페이지당 목록 수
     * @return 자산 변동 상세 내역 페이징 객체
     */
    @GetMapping("/{id}/ledgers")
    public ResponseEntity<org.springframework.data.domain.Page<exchange.admin.repository.LedgerJournalRepository.DetailedLedgerProjection>> getUserLedgers(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ledgerJournalRepository.findDetailedLedgersByUserId(id, org.springframework.data.domain.PageRequest.of(page, size)));
    }
}

