package exchange.admin.controller;

import lombok.extern.slf4j.Slf4j;
import exchange.admin.model.CryptoWithdrawal;
import exchange.admin.model.SystemHotWallet;
import exchange.admin.model.Wallet;
import exchange.admin.repository.CryptoWithdrawalRepository;
import exchange.admin.repository.SystemHotWalletRepository;
import exchange.admin.repository.UserCryptoAddressRepository;
import exchange.admin.repository.WalletRepository;
import exchange.admin.service.WalletDaemonService;
import exchange.admin.service.JAFTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * <h1>CryptoWalletController</h1>
 * 온체인 가상 지갑 자산 조회, 충전(리밸런싱) 및 출금 요청 승인/반려를 수행하는 관리자 전용 REST 컨트롤러입니다.
 * <p>
 * 모든 요청은 {@code /admin/crypto} 경로 하위에서 매핑
 */
@Slf4j
@RestController
@RequestMapping("/admin/crypto")
public class CryptoWalletController {

    /** 출금 요청 내역(CryptoWithdrawal)에 접근하기 위한 리포지토리 */
    @Autowired
    private CryptoWithdrawalRepository cryptoWithdrawalRepository;

    /** 시스템 핫월렛(SystemHotWallet) 잔고 관리를 위한 리포지토리 */
    @Autowired
    private SystemHotWalletRepository systemHotWalletRepository;

    /** 사용자별 발급된 온체인 지갑 주소(UserCryptoAddress) 조회를 위한 리포지토리 */
    @Autowired
    private UserCryptoAddressRepository userCryptoAddressRepository;

    /** 사용자의 가상 지갑(Wallet) 잔고 수정을 위한 리포지토리 */
    @Autowired
    private WalletRepository walletRepository;

    /** 블록체인 시뮬레이션 데몬 및 입금 대기열 관리를 위한 서비스 */
    @Autowired
    private WalletDaemonService walletDaemonService;

    @Autowired
    private JAFTokenService jafTokenService;

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
    public ResponseEntity<?> getAllWithdrawals() {
        // 데이터베이스에서 모든 출금 신청 내역을 생성일시(createdAt) 기준 내림차순(최신순)으로 정렬하여 반환합니다.
        return ResponseEntity.ok(cryptoWithdrawalRepository.findAllByOrderByCreatedAtDesc());
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
    public ResponseEntity<?> getHotWallets() {
        // DB에 저장된 암호화폐별 시스템 핫월렛(BTC, ETH, ADA 등) 잔고 및 정보 목록을 전체 조회합니다.
        return ResponseEntity.ok(systemHotWalletRepository.findAll());
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
    public ResponseEntity<?> getUserAddresses() {
        // 사용자가 입금하기 위해 생성 및 발급받은 온체인 주소 목록 전체를 조회합니다.
        return ResponseEntity.ok(userCryptoAddressRepository.findAll());
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
    public ResponseEntity<?> getPendingDeposits() {
        // WalletDaemonService의 메모리 큐(CopyOnWriteArrayList)에 보관된 대기열 목록을 조회하여 전달합니다.
        return ResponseEntity.ok(walletDaemonService.getPendingDeposits());
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
    public ResponseEntity<?> getBlockHeight() {
        // 가상 블록체인 시뮬레이션의 현재 진행 중인 블록 번호를 반환합니다.
        return ResponseEntity.ok(Map.of("blockHeight", walletDaemonService.getSimulatedBlockHeight()));
    }

    /**
     * [POST] /admin/crypto/withdraw
     * <p>
     * 사용자의 가상 자산 출금 요청을 신규 등록하는 API입니다.
     * 본 API는 트랜잭션 범위 내에서 안전하게 자산을 잠금 처리합니다.
     * </p>
     * <ol>
     * <li>요청 파라미터(사용자 ID, 자산 통화 종류, 출금 수량, 대상 지갑 주소)를 수신합니다.</li>
     * <li>출금 수량이 0보다 큰지 유효성 검사를 수행합니다.</li>
     * <li>사용자의 가상 자산 지갑을 조회하고, 가용 잔고가 출금 요청액보다 많은지 검증합니다.</li>
     * <li>가용 잔고(balance)에서 출금액을 차감하고, 출금 심사 중 자산 유실을 방지하기 위해 잠금 잔고(lockedBalance)에
     * 임시로 가산합니다.</li>
     * <li>초기 상태가 {@code PENDING}인 신규 출금 데이터(CryptoWithdrawal)를 생성 및 저장합니다.</li>
     * </ol>
     *
     * @param payload 사용자 ID(userId), 통화(currency), 수량(amount), 대상 주소(toAddress)를
     *                포함하는 맵
     * @return 200 OK와 함께 저장 완료된 출금 정보 객체 반환, 또는 400 Bad Request 에러 반환
     */
    @PostMapping("/withdraw")
    @Transactional
    public ResponseEntity<?> requestWithdrawal(@RequestBody Map<String, Object> payload) {
        // Payload로부터 필드 추출 및 타입 캐스팅
        Long userId = Long.valueOf(payload.get("userId").toString());
        String currency = payload.get("currency").toString().toUpperCase();
        BigDecimal amount = new BigDecimal(payload.get("amount").toString());
        String toAddress = payload.get("toAddress").toString();

        // 1. 유효성 검사: 출금 신청 금액이 0보다 같거나 작으면 에러 처리
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Amount must be greater than zero"));
        }

        // 2. 가상 지갑 정보 조회
        Wallet wallet = walletRepository.findByUserIdAndCurrency(userId, currency)
                .orElse(null);

        // 3. 가상 지갑이 존재하지 않거나, 가용 잔고(Balance)가 출금 요청 금액보다 작은 경우 잔고 부족 에러 처리
        if (wallet == null || wallet.getBalance().compareTo(amount) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Insufficient virtual balance"));
        }

        // 4. 유저 가상 잔고 락 (차감 후 Locked에 임시 가산)
        wallet.setBalance(wallet.getBalance().subtract(amount));
        wallet.setLockedBalance(wallet.getLockedBalance().add(amount));
        wallet.setUpdatedAt(LocalDateTime.now());
        walletRepository.save(wallet); // 지갑 업데이트 반영

        // 5. 출금 데이터 생성 (초기 상태 PENDING)
        CryptoWithdrawal withdrawal = new CryptoWithdrawal();
        withdrawal.setUserId(userId);
        withdrawal.setCurrency(currency);
        withdrawal.setAmount(amount);
        withdrawal.setToAddress(toAddress);
        withdrawal.setStatus("PENDING"); // 어드민의 승인 대기 상태
        withdrawal.setConfirmations(0); // 현재 온체인 컨펌수는 0
        withdrawal.setCreatedAt(LocalDateTime.now());
        withdrawal.setUpdatedAt(LocalDateTime.now());

        // 6. DB 저장 후 결과 응답
        CryptoWithdrawal saved = cryptoWithdrawalRepository.save(withdrawal);
        return ResponseEntity.ok(saved);
    }

    /**
     * [POST] /admin/crypto/withdrawals/{id}/approve
     * <p>
     * 관리자가 대기 중인 출금 요청을 승인하여 온체인 네트워크로 트랜잭션을 전송(Broadcasting)합니다.
     * </p>
     * <ol>
     * <li>출금 ID를 통해 대상 출금 내역을 조회합니다.</li>
     * <li>출금 상태가 오직 {@code PENDING}(대기)인 경우에만 승인을 진행합니다.</li>
     * <li>거래소 시스템 핫월렛의 가용 온체인 잔고가 승인할 출금 수량보다 많은지 사전 검증합니다.</li>
     * <li>가상 TXID 해시(0x로 시작하는 랜덤 해시값)를 자동 발급합니다.</li>
     * <li>출금의 상태를 {@code BROADCASTED}로 갱신하여 백그라운드 블록 컨펌 감시 대기열에 진입하도록 처리합니다.</li>
     * </ol>
     *
     * @param id 승인하고자 하는 출금 신청 ID
     * @return 200 OK와 함께 변경된 출금 내역 반환, 존재하지 않는 경우 404 Not Found, 예외 상황 시 400 Bad
     *         Request
     */
    @PostMapping("/withdrawals/{id}/approve")
    @Transactional
    public ResponseEntity<?> approveWithdrawal(@PathVariable Long id) {
        // 1. 해당 출금 요청 정보 조회
        CryptoWithdrawal withdrawal = cryptoWithdrawalRepository.findById(id).orElse(null);
        if (withdrawal == null) {
            return ResponseEntity.notFound().build();
        }

        // 2. 대기 상태(PENDING) 검증
        if (!withdrawal.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PENDING requests can be approved."));
        }

        // 3. 시스템 핫월렛 가용 잔고 사전 검증 (핫월렛 온체인 자금이 모자라면 승인 거부)
        SystemHotWallet hotWallet = systemHotWalletRepository.findByCurrency(withdrawal.getCurrency().toUpperCase())
                .orElse(null);
        if (hotWallet == null || hotWallet.getBalance().compareTo(withdrawal.getAmount()) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Insufficient hot wallet on-chain balance."));
        }

        // 4. 가상 트랜잭션 서명 및 브로드캐스트 모사 (TXID 해시 생성) 또는 실물 JAF 토큰 전송
        String txHash;
        if (withdrawal.getCurrency().equalsIgnoreCase("JAF")) {
            try {
                if (jafTokenService.isInitialized()) {
                    txHash = jafTokenService.transfer(withdrawal.getToAddress(), withdrawal.getAmount());
                } else {
                    return ResponseEntity.badRequest().body(Map.of("error", "JAFTokenService is not initialized yet."));
                }
            } catch (Exception e) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "JAF On-chain transfer failed: " + e.getMessage()));
            }
        } else {
            txHash = "0x" + UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 32);
        }
        withdrawal.setTxHash(txHash);
        withdrawal.setStatus("BROADCASTED"); // 블록체인 네트워크에 전송된 상태로 변경
        withdrawal.setConfirmations(0); // 확인수 0부터 시작
        withdrawal.setUpdatedAt(LocalDateTime.now());

        // 5. 변경 데이터 저장
        CryptoWithdrawal saved = cryptoWithdrawalRepository.save(withdrawal);
        log.info("[출금 승인] 출금 ID: {} 승인 완료. TxHash 생성: {}", id, txHash);
        return ResponseEntity.ok(saved);
    }

    /**
     * [POST] /admin/crypto/withdrawals/{id}/reject
     * <p>
     * 관리자가 대기 중인 출금 요청을 반려(Reject)하고 잠겨 있던 유저 자산을 원상 복구합니다.
     * </p>
     * <ol>
     * <li>출금 ID를 통해 대상 출금 내역을 조회합니다.</li>
     * <li>출금 상태가 오직 {@code PENDING}(대기)인 경우에만 반려 처리를 진행합니다.</li>
     * <li>출금 내역의 상태를 {@code REJECTED}로 변경하여 반려 완료 처리합니다.</li>
     * <li>유저의 가상 지갑(Wallet)을 조회하여, 묶여 있던 잠금 잔고(lockedBalance)에서 출금액을 차감하고, 이를 다시 사용
     * 가능한 가용 잔고(balance)로 복원합니다.</li>
     * </ol>
     *
     * @param id 반려하고자 하는 출금 신청 ID
     * @return 200 OK와 함께 변경된 출금 내역 반환, 존재하지 않는 경우 404 Not Found, 예외 상황 시 400 Bad
     *         Request
     */
    @PostMapping("/withdrawals/{id}/reject")
    @Transactional
    public ResponseEntity<?> rejectWithdrawal(@PathVariable Long id) {
        // 1. 해당 출금 요청 정보 조회
        CryptoWithdrawal withdrawal = cryptoWithdrawalRepository.findById(id).orElse(null);
        if (withdrawal == null) {
            return ResponseEntity.notFound().build();
        }

        // 2. 대기 상태(PENDING) 검증
        if (!withdrawal.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PENDING requests can be rejected."));
        }

        // 3. 상태를 REJECTED로 갱신
        withdrawal.setStatus("REJECTED");
        withdrawal.setUpdatedAt(LocalDateTime.now());
        cryptoWithdrawalRepository.save(withdrawal);

        // 4. 유저 가상 잔고 잠금 해제 복구 (Locked 차감 후 Balance 복원)
        Wallet wallet = walletRepository.findByUserIdAndCurrency(withdrawal.getUserId(), withdrawal.getCurrency())
                .orElse(null);
        if (wallet != null) {
            BigDecimal nextLocked = wallet.getLockedBalance().subtract(withdrawal.getAmount());
            if (nextLocked.compareTo(BigDecimal.ZERO) < 0)
                nextLocked = BigDecimal.ZERO; // 음수 방지 예외 처리

            wallet.setLockedBalance(nextLocked);
            wallet.setBalance(wallet.getBalance().add(withdrawal.getAmount()));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletRepository.save(wallet); // 지갑 복구 상태 반영
        }

        return ResponseEntity.ok(withdrawal);
    }

    /**
     * [POST] /admin/crypto/hot-wallets/{id}/rebalance
     * <p>
     * 거래소 시스템 핫월렛에 수동으로 가상 온체인 자산을 공급(충전/리밸런싱)하는 시뮬레이션 API입니다.
     * </p>
     * <ol>
     * <li>핫월렛 ID를 통해 충전할 시스템 핫월렛을 조회합니다.</li>
     * <li>요청 바디에서 충전 수량(amount)을 수신한 뒤, 양수인지 유효성 체크를 진행합니다.</li>
     * <li>해당 시스템 핫월렛의 잔고(balance)에 충전 수량을 가산한 뒤 저장합니다.</li>
     * </ol>
     *
     * @param id      충전하고자 하는 시스템 핫월렛의 ID
     * @param payload 충전 금액(amount)을 포함한 맵
     * @return 200 OK와 함께 충전 완료된 핫월렛 정보 반환, 존재하지 않는 경우 404 Not Found, 예외 상황 시 400
     *         Bad Request
     */
    @PostMapping("/hot-wallets/{id}/rebalance")
    @Transactional
    public ResponseEntity<?> rebalanceHotWallet(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        // 1. 시스템 핫월렛 정보 조회
        SystemHotWallet hotWallet = systemHotWalletRepository.findById(id).orElse(null);
        if (hotWallet == null) {
            return ResponseEntity.notFound().build();
        }

        // 2. 충전 금액 유효성 검사 (0 또는 음수 방지)
        BigDecimal amount = new BigDecimal(payload.get("amount").toString());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Rebalance amount must be positive"));
        }

        // 3. 핫월렛 잔고 충전 가산 반영
        hotWallet.setBalance(hotWallet.getBalance().add(amount));
        hotWallet.setUpdatedAt(LocalDateTime.now());
        SystemHotWallet saved = systemHotWalletRepository.save(hotWallet);

        log.info("[핫월렛 충전] {} 핫월렛에 {} 가 충전되었습니다.", hotWallet.getCurrency(), amount);
        return ResponseEntity.ok(saved);
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
    public ResponseEntity<?> testJafDeposit(@RequestBody Map<String, Object> payload) {
        try {
            Long userId = Long.valueOf(payload.get("userId").toString());
            BigDecimal amount = new BigDecimal(payload.get("amount").toString());
            
            var userAddr = userCryptoAddressRepository.findByUserId(userId).stream()
                    .filter(a -> a.getCurrency().equalsIgnoreCase("JAF"))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("User JAF address not found"));

            if (jafTokenService.isInitialized()) {
                String txHash = jafTokenService.transfer(userAddr.getCryptoAddress(), amount);
                log.info("[테스트 입금 API] JAF 온체인 전송 완료. 수신주소: {}, TxHash: {}", userAddr.getCryptoAddress(), txHash);
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "txHash", txHash,
                        "toAddress", userAddr.getCryptoAddress(),
                        "amount", amount
                ));
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "JAFTokenService is not initialized."));
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
