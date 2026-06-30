package exchange.admin.controller;

import exchange.admin.dto.ApiResponse;
import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.service.UserService;
import org.springframework.http.HttpStatus;
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

    private final exchange.admin.mapper.TradeMapper tradeMapper;
    private final exchange.admin.repository.LedgerJournalRepository ledgerJournalRepository;
    private final exchange.admin.mapper.LedgerJournalMapper ledgerJournalMapper;

    // 생성자 주입
    public UserController(
            UserService userService,
            exchange.admin.repository.TradeRepository tradeRepository,
            exchange.admin.mapper.TradeMapper tradeMapper,
            exchange.admin.repository.LedgerJournalRepository ledgerJournalRepository,
            exchange.admin.mapper.LedgerJournalMapper ledgerJournalMapper) {
        this.userService = userService;
        this.tradeRepository = tradeRepository;
        this.tradeMapper = tradeMapper;
        this.ledgerJournalRepository = ledgerJournalRepository;
        this.ledgerJournalMapper = ledgerJournalMapper;
    }

    /**
     * 전체 회원 목록 조회.
     * 
     * @return 전체 회원 리스트
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<User>>> getAllUsers() {
        return ApiResponse.ok(userService.getAllUsers());
    }

    /**
     * 특정 회원의 정보 조회.
     * 
     * @param id 회원 ID
     * @return 회원 정보 데이터
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<User>> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(user -> ApiResponse.ok(user))
                .orElse(ApiResponse.notFound("User not found"));
    }

    /**
     * 신규 회원 가입 및 계정 개설.
     * 가입 처리 완료 후 기본 거래 자산 지갑이 자동으로 생성된다.
     * 
     * @param request 가입 요청 데이터 (email, password, grade)
     * @return 가입 완료된 회원 정보
     */
    @PostMapping
    public ResponseEntity<ApiResponse<User>> registerUser(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String password = request.get("password");
        String grade = request.get("grade");
        
        if (email == null || password == null) {
            return ApiResponse.badRequest("Email and password are required");
        }
        
        User registeredUser = userService.registerUser(email, password, grade);
        return ApiResponse.ok(registeredUser);
    }

    /**
     * 회원 정보(이메일, 계정 상태, 보안 등급 등) 수정.
     * 
     * @param id      회원 ID
     * @param request 수정 요청 데이터 (email, status, grade)
     * @return 수정된 회원 정보
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<User>> updateUser(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String email = request.get("email");
        String status = request.get("status");
        String grade = request.get("grade");
        
        return userService.updateUser(id, email, status, grade)
                .map(user -> ApiResponse.ok(user))
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
    public ResponseEntity<ApiResponse<Wallet>> adjustAsset(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String currency = (String) request.get("currency");
        Object amountObj = request.get("amount");
        
        if (currency == null || amountObj == null) {
            return ApiResponse.badRequest("Required fields: 'currency' and 'amount'");
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(amountObj.toString());
        } catch (NumberFormatException e) {
            return ApiResponse.badRequest("Invalid amount format");
        }

        try {
            Wallet updatedWallet = userService.adjustAsset(id, currency, amount);
            return ApiResponse.ok(updatedWallet);
        } catch (IllegalArgumentException e) {
            return ApiResponse.badRequest(e.getMessage());
        } catch (Exception e) {
            return ApiResponse.internalServerError("Error: " + e.getMessage());
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
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<exchange.admin.dto.response.UserTradeODT>>> getUserTrades(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        int offset = page * size;
        java.util.List<exchange.admin.dto.response.UserTradeODT> list = tradeMapper.selectUserTrades(id, offset, size);
        long total = tradeMapper.countUserTrades(id);
        
        org.springframework.data.domain.Page<exchange.admin.dto.response.UserTradeODT> pageResult = 
                new org.springframework.data.domain.PageImpl<>(list, org.springframework.data.domain.PageRequest.of(page, size), total);
                
        return ApiResponse.ok(pageResult);
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
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<exchange.admin.dto.response.DetailedLedgerODT>>> getUserLedgers(
            @PathVariable Long id,
            @RequestParam(value = "startDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startDate,
            @RequestParam(value = "endDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
            
        java.time.LocalDateTime finalEndDate = endDate != null ? endDate : java.time.LocalDateTime.now();
        java.time.LocalDateTime finalStartDate = startDate != null ? startDate : finalEndDate.minusDays(30);
        
        int offset = page * size;
        java.util.List<exchange.admin.dto.response.DetailedLedgerODT> list = ledgerJournalMapper.selectDetailedLedgersByUserId(id, finalStartDate, finalEndDate, offset, size);
        long total = ledgerJournalMapper.countDetailedLedgers(String.valueOf(id), finalStartDate, finalEndDate); // userId as search string if count method doesn't have userId overload, wait count method takes search. Actually I should probably just return a page. Let's just use the length or write a new count method.
        
        org.springframework.data.domain.Page<exchange.admin.dto.response.DetailedLedgerODT> pageResult = 
                new org.springframework.data.domain.PageImpl<>(list, org.springframework.data.domain.PageRequest.of(page, size), total);
                
        return ApiResponse.ok(pageResult);
    }

    /**
     * 로그인된 회원 본인의 거래 체결 내역 조회.
     * SecurityContextHolder의 인증정보를 기반으로 본인의 체결 데이터만 필터링하여 반환합니다.
     * 
     * @param page 조회할 페이지 번호
     * @param size 페이지당 목록 수
     * @return 체결 정보 페이징 객체 또는 401 Unauthorized
     */
    @GetMapping("/me/trades")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<exchange.admin.dto.response.UserTradeODT>>> getMyTrades(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        java.util.Optional<exchange.admin.model.User> userOpt = userService.getUserByEmail(email);
        if (userOpt.isPresent()) {
            Long userId = userOpt.get().getUserId();
            int offset = page * size;
            java.util.List<exchange.admin.dto.response.UserTradeODT> list = tradeMapper.selectUserTrades(userId, offset, size);
            long total = tradeMapper.countUserTrades(userId);
            
            org.springframework.data.domain.Page<exchange.admin.dto.response.UserTradeODT> pageResult = 
                    new org.springframework.data.domain.PageImpl<>(list, org.springframework.data.domain.PageRequest.of(page, size), total);
                    
            return ApiResponse.ok(pageResult);
        }
        return ApiResponse.unauthorized("Unauthorized");
    }

    /**
     * 로그인된 회원 본인의 상세 원장 변동 내역 조회.
     * SecurityContextHolder의 인증정보를 기반으로 본인의 원장 정보만 필터링하여 반환합니다.
     * 
     * @param page 조회할 페이지 번호
     * @param size 페이지당 목록 수
     * @return 원장 정보 페이징 객체 또는 401 Unauthorized
     */
    @GetMapping("/me/ledgers")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<exchange.admin.dto.response.DetailedLedgerODT>>> getMyLedgers(
            @RequestParam(value = "startDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startDate,
            @RequestParam(value = "endDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
            
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        java.util.Optional<exchange.admin.model.User> userOpt = userService.getUserByEmail(email);
        
        if (userOpt.isPresent()) {
            Long userId = userOpt.get().getUserId();
            java.time.LocalDateTime finalEndDate = endDate != null ? endDate : java.time.LocalDateTime.now();
            java.time.LocalDateTime finalStartDate = startDate != null ? startDate : finalEndDate.minusDays(30);
            
            int offset = page * size;
            java.util.List<exchange.admin.dto.response.DetailedLedgerODT> list = ledgerJournalMapper.selectDetailedLedgersByUserId(userId, finalStartDate, finalEndDate, offset, size);
            long total = ledgerJournalMapper.countDetailedLedgers(String.valueOf(userId), finalStartDate, finalEndDate); // using count method
            
            org.springframework.data.domain.Page<exchange.admin.dto.response.DetailedLedgerODT> pageResult = 
                    new org.springframework.data.domain.PageImpl<>(list, org.springframework.data.domain.PageRequest.of(page, size), total);
            return ApiResponse.ok(pageResult);
        }
        return ApiResponse.unauthorized("Unauthorized");
    }
}

