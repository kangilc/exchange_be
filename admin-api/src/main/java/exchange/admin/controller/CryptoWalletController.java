package exchange.admin.controller;

import lombok.extern.slf4j.Slf4j;
import exchange.admin.dto.ApiResponse;
import exchange.admin.model.CryptoWithdrawal;
import exchange.admin.model.SystemHotWallet;
import exchange.admin.repository.CryptoWithdrawalRepository;
import exchange.admin.repository.SystemHotWalletRepository;
import exchange.admin.repository.UserCryptoAddressRepository;
import exchange.admin.service.WalletDaemonService;
import exchange.admin.service.CoinNetworkService;
import exchange.admin.service.WalletService;
import exchange.admin.dto.request.wallet.WithdrawRequestIDT;
import exchange.admin.dto.request.wallet.RebalanceRequestIDT;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

/**
 * <h1>CryptoWalletController</h1>
 * 온체인 가상 지갑 자산 조회, 충전(리밸런싱) 및 출금 요청 승인/반려를 수행하는 관리자 전용 REST 컨트롤러입니다.
 * <p>
 * 모든 요청은 {@code /admin/crypto} 경로 하위에서 매핑
 */
@Slf4j
@RestController
@RequestMapping("/admin/crypto")
@lombok.RequiredArgsConstructor
public class CryptoWalletController {

    private final WalletService walletService;

    /** 출금 요청 내역(CryptoWithdrawal)에 접근하기 위한 리포지토리 */
    private final CryptoWithdrawalRepository cryptoWithdrawalRepository;

    /** 시스템 핫월렛(SystemHotWallet) 잔고 관리를 위한 리포지토리 */
    private final SystemHotWalletRepository systemHotWalletRepository;

    /** 사용자별 발급된 온체인 지갑 주소(UserCryptoAddress) 조회를 위한 리포지토리 */
    private final UserCryptoAddressRepository userCryptoAddressRepository;

    /** 블록체인 시뮬레이션 데몬 및 입금 대기열 관리를 위한 서비스 */
    private final WalletDaemonService walletDaemonService;

    private final java.util.List<CoinNetworkService> coinNetworkServices;

    /**
     * [GET] /admin/crypto/withdrawals
     * <p>
     * 거래소에 접수된 전체 암호화폐 출금 신청 목록을 조회합니다.
     * 최신 순으로 정렬하여 반환합니다.
     * </p>
     *
     * @return 200 OK와 함께 전체 출금 신청 목록 반환
     */
    @GetMapping("/withdrawals")
    public ResponseEntity<ApiResponse<java.util.List<CryptoWithdrawal>>> getAllWithdrawals() {
        // 데이터베이스에서 모든 출금 신청 내역을 생성일시(createdAt) 기준 내림차순(최신순)으로 정렬하여 반환합니다.
        return ApiResponse.ok(cryptoWithdrawalRepository.findAllByOrderByCreatedAtDesc());
    }

    /**
     * [GET] /admin/crypto/hot-wallets
     * <p>
     * 거래소 시스템 소유의 각 암호화폐별 핫월렛(System Hot Wallet) 정보 및 잔고 목록을 조회합니다.
     * 시스템 핫월렛은 출금 승인 시 실제로 온체인 자금이 나가는 원천 지갑입니다.
     * </p>
     *
     * @return 200 OK와 함께 시스템 핫월렛 목록 반환
     */
    @GetMapping("/hot-wallets")
    public ResponseEntity<ApiResponse<java.util.List<SystemHotWallet>>> getHotWallets() {
        // DB에 저장된 암호화폐별 시스템 핫월렛(BTC, ETH, ADA 등) 잔고 및 정보 목록을 전체 조회합니다.
        return ApiResponse.ok(systemHotWalletRepository.findAll());
    }

    /**
     * [GET] /admin/crypto/addresses
     * <p>
     * 사용자들이 발급받은 전체 온체인 입금용 지갑 주소 목록을 조회합니다.
     * </p>
     *
     * @return 200 OK와 함께 전체 사용자 주소 목록 반환
     */
    @GetMapping("/addresses")
    public ResponseEntity<ApiResponse<java.util.List<exchange.admin.model.UserCryptoAddress>>> getUserAddresses() {
        // 사용자가 입금하기 위해 생성 및 발급받은 온체인 주소 목록 전체를 조회합니다.
        return ApiResponse.ok(userCryptoAddressRepository.findAll());
    }

    /**
     * [GET] /admin/crypto/pending-deposits
     * <p>
     * 현재 백그라운드 데몬에서 블록체인 입금 감지 후 컨펌 단계 진행 중인 가상 트랜잭션 목록을 조회합니다.
     * </p>
     *
     * @return 200 OK와 함께 현재 진행 중인 미확정 입금 트랜잭션 목록 반환
     */
    @GetMapping("/pending-deposits")
    public ResponseEntity<ApiResponse<java.util.List<exchange.admin.service.WalletDaemonService.PendingDeposit>>> getPendingDeposits() {
        // WalletDaemonService의 메모리 큐(CopyOnWriteArrayList)에 보관된 대기열 목록을 조회하여 전달합니다.
        return ApiResponse.ok(walletDaemonService.getPendingDeposits());
    }

    /**
     * [GET] /admin/crypto/block-height
     * <p>
     * 현재 시뮬레이션되고 있는 가상 블록체인의 블록 높이(Block Height) 정보를 조회합니다.
     * </p>
     *
     * @return 200 OK와 함께 현재 블록 높이(blockHeight) 맵 형태로 반환
     */
    @GetMapping("/block-height")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getBlockHeight() {
        // 가상 블록체인 시뮬레이션의 현재 진행 중인 블록 번호를 반환합니다.
        return ApiResponse.ok(Map.of("blockHeight", walletDaemonService.getSimulatedBlockHeight()));
    }

    /**
     * [POST] /admin/crypto/withdraw
     * <p>
     * 사용자의 가상 자산 출금 요청을 신규 등록하는 API입니다.
     * 본 API는 트랜잭션 범위 내에서 안전하게 자산을 잠금 처리합니다.
     * </p>
     *
     * @param idt 사용자 ID(userId), 통화(currency), 수량(amount), 대상 주소(toAddress)를 포함하는 DTO
     * @return 200 OK와 함께 저장 완료된 출금 정보 객체 반환, 또는 400 Bad Request 에러 반환
     */
    @PostMapping("/withdraw")
    public ResponseEntity<ApiResponse<CryptoWithdrawal>> requestWithdrawal(@RequestBody WithdrawRequestIDT idt) {
        try {
            CryptoWithdrawal saved = walletService.requestWithdrawal(idt);
            return ApiResponse.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * [POST] /admin/crypto/withdrawals/{id}/approve
     * <p>
     * 관리자가 대기 중인 출금 요청을 승인하여 온체인 네트워크로 트랜잭션을 전송(Broadcasting)합니다.
     * </p>
     *
     * @param id 승인하고자 하는 출금 신청 ID
     * @return 200 OK와 함께 변경된 출금 내역 반환, 존재하지 않는 경우 404 Not Found, 예외 상황 시 400 Bad Request
     */
    @PostMapping("/withdrawals/{id}/approve")
    public ResponseEntity<ApiResponse<CryptoWithdrawal>> approveWithdrawal(@PathVariable Long id) {
        try {
            CryptoWithdrawal saved = walletService.approveWithdrawal(id);
            return ApiResponse.ok(saved);
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Not Found"));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * [POST] /admin/crypto/withdrawals/{id}/reject
     * <p>
     * 관리자가 대기 중인 출금 요청을 반려(Reject)하고 잠겨 있던 유저 자산을 원상 복구합니다.
     * </p>
     *
     * @param id 반려하고자 하는 출금 신청 ID
     * @return 200 OK와 함께 변경된 출금 내역 반환, 존재하지 않는 경우 404 Not Found, 예외 상황 시 400 Bad Request
     */
    @PostMapping("/withdrawals/{id}/reject")
    public ResponseEntity<ApiResponse<CryptoWithdrawal>> rejectWithdrawal(@PathVariable Long id) {
        try {
            CryptoWithdrawal saved = walletService.rejectWithdrawal(id);
            return ApiResponse.ok(saved);
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Not Found"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * [POST] /admin/crypto/hot-wallets/{id}/rebalance
     * <p>
     * 거래소 시스템 핫월렛에 수동으로 가상 온체인 자산을 공급(충전/리밸런싱)하는 시뮬레이션 API입니다.
     * </p>
     *
     * @param id      충전하고자 하는 시스템 핫월렛의 ID
     * @param idt     충전 금액(amount)을 포함한 DTO
     * @return 200 OK와 함께 충전 완료된 핫월렛 정보 반환, 존재하지 않는 경우 404 Not Found, 예외 상황 시 400 Bad Request
     */
    @PostMapping("/hot-wallets/{id}/rebalance")
    public ResponseEntity<ApiResponse<SystemHotWallet>> rebalanceHotWallet(@PathVariable Long id,
            @RequestBody RebalanceRequestIDT idt) {
        try {
            SystemHotWallet saved = walletService.rebalanceHotWallet(id, idt);
            return ApiResponse.ok(saved);
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Not Found"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), e.getMessage()));
        }
    }

    /**
     * [POST] /admin/crypto/test-jaf-deposit
     * <p>
     * 테스트용 JAF 토큰 입금을 강제로 수행하는 모의 입금 API입니다.
     * </p>
     * 
     * @param payload 사용자 ID(userId)와 입금 수량(amount)을 담은 맵
     * @return 200 OK와 함께 전송 결과(성공 여부, txHash, 수신주소, 금액) 또는 에러 반환
     */
    @PostMapping("/test-jaf-deposit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> testJafDeposit(@RequestBody Map<String, Object> payload) {
        try {
            Long userId = Long.valueOf(payload.get("userId").toString());
            BigDecimal amount = new BigDecimal(payload.get("amount").toString());

            var userAddr = userCryptoAddressRepository.findByUserId(userId).stream()
                    .filter(a -> a.getCurrency().equalsIgnoreCase("JAF"))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("User JAF address not found"));

            // CoinNetworkService 리스트에서 JAF 지원 서비스를 탐색
            CoinNetworkService jafService = coinNetworkServices.stream()
                    .filter(s -> s.supports("JAF"))
                    .findFirst()
                    .orElse(null);

            if (jafService != null && jafService.isInitialized()) {
                String txHash = jafService.transfer(userAddr.getCryptoAddress(), amount);
                log.info("[테스트 입금 API] JAF 온체인 전송 완료. 수신주소: {}, TxHash: {}", userAddr.getCryptoAddress(), txHash);
                return ApiResponse.ok(Map.of(
                        "success", true,
                        "txHash", txHash,
                        "toAddress", userAddr.getCryptoAddress(),
                        "amount", amount));
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), "JafCoinService is not initialized."));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR.value(), e.getMessage()));
        }
    }
}
