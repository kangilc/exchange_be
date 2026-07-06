package exchange.admin.controller;

import lombok.extern.slf4j.Slf4j;
import exchange.admin.dto.ApiResponse;
import exchange.admin.dto.response.CryptoWithdrawalODT;
import exchange.admin.dto.response.SystemHotWalletODT;
import exchange.admin.dto.response.UserCryptoAddressODT;
import exchange.admin.model.CryptoWithdrawal;
import exchange.admin.model.SystemHotWallet;
import exchange.admin.model.UserCryptoAddress;
import exchange.admin.repository.CryptoWithdrawalRepository;
import exchange.admin.repository.SystemHotWalletRepository;
import exchange.admin.repository.UserCryptoAddressRepository;
import exchange.admin.service.WalletDaemonService;
import exchange.admin.service.CoinNetworkService;
import exchange.admin.service.WalletService;
import exchange.admin.dto.request.wallet.WithdrawRequestIDT;
import exchange.admin.dto.request.wallet.RebalanceRequestIDT;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.List;

/**
 * 온체인 가상 지갑 자산 조회, 충전(리밸런싱) 및 출금 요청 승인/반려를 수행하는 관리자 전용 REST 컨트롤러입니다.
 */
@Slf4j
@RestController
@RequestMapping("/admin/crypto")
@CrossOrigin(origins = "*")
public class CryptoWalletController {

    private final WalletService walletService;
    private final CryptoWithdrawalRepository cryptoWithdrawalRepository;
    private final SystemHotWalletRepository systemHotWalletRepository;
    private final UserCryptoAddressRepository userCryptoAddressRepository;
    private final WalletDaemonService walletDaemonService;
    private final List<CoinNetworkService> coinNetworkServices;

    // 수동 생성자 주입 표준 적용 (Autowired 금지 규칙)
    public CryptoWalletController(
            WalletService walletService,
            CryptoWithdrawalRepository cryptoWithdrawalRepository,
            SystemHotWalletRepository systemHotWalletRepository,
            UserCryptoAddressRepository userCryptoAddressRepository,
            WalletDaemonService walletDaemonService,
            List<CoinNetworkService> coinNetworkServices) {
        this.walletService = walletService;
        this.cryptoWithdrawalRepository = cryptoWithdrawalRepository;
        this.systemHotWalletRepository = systemHotWalletRepository;
        this.userCryptoAddressRepository = userCryptoAddressRepository;
        this.walletDaemonService = walletDaemonService;
        this.coinNetworkServices = coinNetworkServices;
    }

    /**
     * 거래소에 접수된 전체 암호화폐 출금 신청 목록을 페이징 조회합니다.
     *
     * @param pageable 페이징 정보
     * @return 출금 신청 목록 페이징 데이터
     */
    @GetMapping("/withdrawals")
    public ResponseEntity<ApiResponse<Page<CryptoWithdrawalODT>>> getAllWithdrawals(@PageableDefault(size = 10) Pageable pageable) {
        Page<CryptoWithdrawal> withdrawals = cryptoWithdrawalRepository.findAllByOrderByCreatedAtDesc(pageable);
        return ApiResponse.ok(withdrawals.map(CryptoWithdrawalODT::new));
    }

    /**
     * 거래소 시스템 소유의 각 암호화폐별 핫월렛 정보 및 잔고 목록을 페이징 조회합니다.
     *
     * @param pageable 페이징 정보
     * @return 시스템 핫월렛 목록 페이징 데이터
     */
    @GetMapping("/hot-wallets")
    public ResponseEntity<ApiResponse<Page<SystemHotWalletODT>>> getHotWallets(@PageableDefault(size = 10) Pageable pageable) {
        Page<SystemHotWallet> wallets = systemHotWalletRepository.findAll(pageable);
        return ApiResponse.ok(wallets.map(SystemHotWalletODT::new));
    }

    /**
     * 사용자들이 발급받은 전체 온체인 입금용 지갑 주소 목록을 페이징 조회합니다.
     *
     * @param pageable 페이징 정보
     * @return 전체 사용자 주소 목록 페이징 데이터
     */
    @GetMapping("/addresses")
    public ResponseEntity<ApiResponse<Page<UserCryptoAddressODT>>> getUserAddresses(@PageableDefault(size = 10) Pageable pageable) {
        Page<UserCryptoAddress> addresses = userCryptoAddressRepository.findAll(pageable);
        return ApiResponse.ok(addresses.map(UserCryptoAddressODT::new));
    }

    /**
     * 현재 백그라운드 데몬에서 블록체인 입금 감지 후 컨펌 단계 진행 중인 가상 트랜잭션 목록을 조회합니다.
     */
    @GetMapping("/pending-deposits")
    public ResponseEntity<ApiResponse<List<WalletDaemonService.PendingDeposit>>> getPendingDeposits() {
        return ApiResponse.ok(walletDaemonService.getPendingDeposits());
    }

    /**
     * 현재 시뮬레이션되고 있는 가상 블록체인의 블록 높이 정보를 조회합니다.
     */
    @GetMapping("/block-height")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getBlockHeight() {
        return ApiResponse.ok(Map.of("blockHeight", walletDaemonService.getSimulatedBlockHeight()));
    }

    /**
     * 사용자의 가상 자산 출금 요청을 신규 등록합니다.
     */
    @PostMapping("/withdraw")
    public ResponseEntity<ApiResponse<CryptoWithdrawalODT>> requestWithdrawal(@RequestBody WithdrawRequestIDT idt) {
        try {
            CryptoWithdrawal saved = walletService.requestWithdrawal(idt);
            return ApiResponse.ok(new CryptoWithdrawalODT(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * 관리자가 대기 중인 출금 요청을 승인하여 온체인 네트워크로 트랜잭션을 전송합니다.
     */
    @PostMapping("/withdrawals/{id}/approve")
    public ResponseEntity<ApiResponse<CryptoWithdrawalODT>> approveWithdrawal(@PathVariable Long id) {
        try {
            CryptoWithdrawal saved = walletService.approveWithdrawal(id);
            return ApiResponse.ok(new CryptoWithdrawalODT(saved));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Not Found"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * 관리자가 대기 중인 출금 요청을 반려하고 잠겨 있던 유저 자산을 원상 복구합니다.
     */
    @PostMapping("/withdrawals/{id}/reject")
    public ResponseEntity<ApiResponse<CryptoWithdrawalODT>> rejectWithdrawal(@PathVariable Long id) {
        try {
            CryptoWithdrawal saved = walletService.rejectWithdrawal(id);
            return ApiResponse.ok(new CryptoWithdrawalODT(saved));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Not Found"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * 거래소 시스템 핫월렛에 수동으로 가상 온체인 자산을 공급하는 시뮬레이션 API입니다.
     */
    @PostMapping("/hot-wallets/{id}/rebalance")
    public ResponseEntity<ApiResponse<SystemHotWalletODT>> rebalanceHotWallet(@PathVariable Long id,
            @RequestBody RebalanceRequestIDT idt) {
        try {
            SystemHotWallet saved = walletService.rebalanceHotWallet(id, idt);
            return ApiResponse.ok(new SystemHotWalletODT(saved));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Not Found"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * 테스트용 JAF 토큰 입금을 강제로 수행하는 모의 입금 API입니다.
     * (함수 50줄 이내 규칙 적용을 위해 비즈니스 로직을 분리함)
     */
    @PostMapping("/test-jaf-deposit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testJafDeposit(@RequestBody Map<String, Object> payload) {
        try {
            Long userId = Long.valueOf(payload.get("userId").toString());
            BigDecimal amount = new BigDecimal(payload.get("amount").toString());
            Map<String, Object> result = processJafDeposit(userId, amount);
            return ApiResponse.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR.value(), e.getMessage()));
        }
    }

    /**
     * JAF 토큰 입금 처리 및 온체인 전송 수행 프라이빗 메소드.
     */
    private Map<String, Object> processJafDeposit(Long userId, BigDecimal amount) throws Exception {
        UserCryptoAddress userAddr = userCryptoAddressRepository.findByUserId(userId).stream()
                .filter(a -> a.getCurrency().equalsIgnoreCase("JAF"))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("User JAF address not found"));

        CoinNetworkService jafService = coinNetworkServices.stream()
                .filter(s -> s.supports("JAF"))
                .findFirst()
                .orElse(null);

        if (jafService != null && jafService.isInitialized()) {
            String txHash = jafService.transfer(userAddr.getCryptoAddress(), amount);
            log.info("[테스트 입금 API] JAF 온체인 전송 완료. 수신주소: {}, TxHash: {}", userAddr.getCryptoAddress(), txHash);
            return Map.of(
                    "success", true,
                    "txHash", txHash,
                    "toAddress", userAddr.getCryptoAddress(),
                    "amount", amount);
        } else {
            throw new IllegalStateException("JafCoinService is not initialized.");
        }
    }
}
