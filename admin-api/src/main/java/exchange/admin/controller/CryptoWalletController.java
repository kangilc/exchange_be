package exchange.admin.controller;

import exchange.admin.model.CryptoWithdrawal;
import exchange.admin.model.SystemHotWallet;
import exchange.admin.model.UserCryptoAddress;
import exchange.admin.model.Wallet;
import exchange.admin.repository.CryptoWithdrawalRepository;
import exchange.admin.repository.SystemHotWalletRepository;
import exchange.admin.repository.UserCryptoAddressRepository;
import exchange.admin.repository.WalletRepository;
import exchange.admin.service.WalletDaemonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/admin/crypto")
@CrossOrigin(origins = "*")
public class CryptoWalletController {

    @Autowired
    private CryptoWithdrawalRepository cryptoWithdrawalRepository;

    @Autowired
    private SystemHotWalletRepository systemHotWalletRepository;

    @Autowired
    private UserCryptoAddressRepository userCryptoAddressRepository;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private WalletDaemonService walletDaemonService;

    @GetMapping("/withdrawals")
    public ResponseEntity<?> getAllWithdrawals() {
        return ResponseEntity.ok(cryptoWithdrawalRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/hot-wallets")
    public ResponseEntity<?> getHotWallets() {
        return ResponseEntity.ok(systemHotWalletRepository.findAll());
    }

    @GetMapping("/addresses")
    public ResponseEntity<?> getUserAddresses() {
        return ResponseEntity.ok(userCryptoAddressRepository.findAll());
    }

    @GetMapping("/pending-deposits")
    public ResponseEntity<?> getPendingDeposits() {
        return ResponseEntity.ok(walletDaemonService.getPendingDeposits());
    }

    @GetMapping("/block-height")
    public ResponseEntity<?> getBlockHeight() {
        return ResponseEntity.ok(Map.of("blockHeight", walletDaemonService.getSimulatedBlockHeight()));
    }

    /**
     * 출금 신청을 신규 접수한다 (테스트용/시뮬레이션용 단일 트랜잭션).
     */
    @PostMapping("/withdraw")
    @Transactional
    public ResponseEntity<?> requestWithdrawal(@RequestBody Map<String, Object> payload) {
        Long userId = Long.valueOf(payload.get("userId").toString());
        String currency = payload.get("currency").toString().toUpperCase();
        BigDecimal amount = new BigDecimal(payload.get("amount").toString());
        String toAddress = payload.get("toAddress").toString();

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Amount must be greater than zero"));
        }

        Wallet wallet = walletRepository.findByUserIdAndCurrency(userId, currency)
                .orElse(null);
        if (wallet == null || wallet.getBalance().compareTo(amount) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Insufficient virtual balance"));
        }

        // 1. 유저 가상 잔고 잠금 (차감 후 Locked 가산)
        wallet.setBalance(wallet.getBalance().subtract(amount));
        wallet.setLockedBalance(wallet.getLockedBalance().add(amount));
        wallet.setUpdatedAt(LocalDateTime.now());
        walletRepository.save(wallet);

        // 2. 출금 데이터 생성 (PENDING 상태)
        CryptoWithdrawal withdrawal = new CryptoWithdrawal();
        withdrawal.setUserId(userId);
        withdrawal.setCurrency(currency);
        withdrawal.setAmount(amount);
        withdrawal.setToAddress(toAddress);
        withdrawal.setStatus("PENDING");
        withdrawal.setConfirmations(0);
        withdrawal.setCreatedAt(LocalDateTime.now());
        withdrawal.setUpdatedAt(LocalDateTime.now());

        CryptoWithdrawal saved = cryptoWithdrawalRepository.save(withdrawal);
        return ResponseEntity.ok(saved);
    }

    /**
     * 관리자가 출금 요청을 승인하여 온체인 네트워크로 트랜잭션을 전송(Broadcasting)한다.
     */
    @PostMapping("/withdrawals/{id}/approve")
    @Transactional
    public ResponseEntity<?> approveWithdrawal(@PathVariable Long id) {
        CryptoWithdrawal withdrawal = cryptoWithdrawalRepository.findById(id).orElse(null);
        if (withdrawal == null) {
            return ResponseEntity.notFound().build();
        }

        if (!withdrawal.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PENDING requests can be approved."));
        }

        // 핫월렛 가용 잔고 사전 검사
        SystemHotWallet hotWallet = systemHotWalletRepository.findByCurrency(withdrawal.getCurrency().toUpperCase())
                .orElse(null);
        if (hotWallet == null || hotWallet.getBalance().compareTo(withdrawal.getAmount()) < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Insufficient hot wallet on-chain balance."));
        }

        // 1. 트랜잭션 서명 및 브로드캐스트 모사
        String txHash = "0x" + UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 32);
        withdrawal.setTxHash(txHash);
        withdrawal.setStatus("BROADCASTED");
        withdrawal.setConfirmations(0);
        withdrawal.setUpdatedAt(LocalDateTime.now());

        CryptoWithdrawal saved = cryptoWithdrawalRepository.save(withdrawal);
        System.out.println(String.format("[출금 승인] 출금 ID: %d 승인 완료. TxHash 생성: %s", id, txHash));
        return ResponseEntity.ok(saved);
    }

    /**
     * 관리자가 출금을 반려(Reject)하여 유저 잠금 잔고를 원상 복구한다.
     */
    @PostMapping("/withdrawals/{id}/reject")
    @Transactional
    public ResponseEntity<?> rejectWithdrawal(@PathVariable Long id) {
        CryptoWithdrawal withdrawal = cryptoWithdrawalRepository.findById(id).orElse(null);
        if (withdrawal == null) {
            return ResponseEntity.notFound().build();
        }

        if (!withdrawal.getStatus().equals("PENDING")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Only PENDING requests can be rejected."));
        }

        // 1. 상태를 REJECTED로 갱신
        withdrawal.setStatus("REJECTED");
        withdrawal.setUpdatedAt(LocalDateTime.now());
        cryptoWithdrawalRepository.save(withdrawal);

        // 2. 유저 가상 잔고 복구 (Locked 차감 후 Balance 복원)
        Wallet wallet = walletRepository.findByUserIdAndCurrency(withdrawal.getUserId(), withdrawal.getCurrency())
                .orElse(null);
        if (wallet != null) {
            BigDecimal nextLocked = wallet.getLockedBalance().subtract(withdrawal.getAmount());
            if (nextLocked.compareTo(BigDecimal.ZERO) < 0) nextLocked = BigDecimal.ZERO;
            
            wallet.setLockedBalance(nextLocked);
            wallet.setBalance(wallet.getBalance().add(withdrawal.getAmount()));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletRepository.save(wallet);
        }

        return ResponseEntity.ok(withdrawal);
    }

    /**
     * 시스템 핫월렛 수동 모의 충전 (Rebalance)
     */
    @PostMapping("/hot-wallets/{id}/rebalance")
    @Transactional
    public ResponseEntity<?> rebalanceHotWallet(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        SystemHotWallet hotWallet = systemHotWalletRepository.findById(id).orElse(null);
        if (hotWallet == null) {
            return ResponseEntity.notFound().build();
        }

        BigDecimal amount = new BigDecimal(payload.get("amount").toString());
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Rebalance amount must be positive"));
        }

        hotWallet.setBalance(hotWallet.getBalance().add(amount));
        hotWallet.setUpdatedAt(LocalDateTime.now());
        SystemHotWallet saved = systemHotWalletRepository.save(hotWallet);
        
        System.out.println(String.format("[핫월렛 충전] %s 핫월렛에 %s 가 충전되었습니다.", hotWallet.getCurrency(), amount));
        return ResponseEntity.ok(saved);
    }
}
