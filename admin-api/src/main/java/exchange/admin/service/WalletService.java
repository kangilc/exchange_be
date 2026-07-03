package exchange.admin.service;

import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import exchange.admin.model.CryptoWithdrawal;
import exchange.admin.model.SystemHotWallet;
import exchange.admin.model.Wallet;
import exchange.admin.repository.CryptoWithdrawalRepository;
import exchange.admin.repository.SystemHotWalletRepository;
import exchange.admin.repository.UserCryptoAddressRepository;
import exchange.admin.repository.WalletRepository;
import exchange.admin.dto.request.wallet.WithdrawRequestIDT;
import exchange.admin.dto.request.wallet.RebalanceRequestIDT;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.NoSuchElementException;

/**
 * 지갑 및 온체인 자산 거래 관련 비즈니스 로직을 처리하는 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final CryptoWithdrawalRepository cryptoWithdrawalRepository;
    private final SystemHotWalletRepository systemHotWalletRepository;
    private final WalletRepository walletRepository;
    private final UserCryptoAddressRepository userCryptoAddressRepository;
    private final JAFTokenService jafTokenService;

    /**
     * 사용자의 가상 자산 출금 요청을 등록하고 잔고를 잠금 처리한다.
     *
     * @param idt 출금 요청 정보 객체
     * @return 저장 완료된 출금 요청 내역
     */
    @Transactional
    public CryptoWithdrawal requestWithdrawal(WithdrawRequestIDT idt) {
        if (idt.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }

        Wallet wallet = walletRepository.findByUserIdAndCurrency(idt.getUserId(), idt.getCurrency().toUpperCase())
                .orElse(null);

        if (wallet == null || wallet.getBalance().compareTo(idt.getAmount()) < 0) {
            throw new IllegalArgumentException("Insufficient virtual balance");
        }

        // 잔고 차감 및 락업 가산
        wallet.setBalance(wallet.getBalance().subtract(idt.getAmount()));
        wallet.setLockedBalance(wallet.getLockedBalance().add(idt.getAmount()));
        wallet.setUpdatedAt(LocalDateTime.now());
        walletRepository.save(wallet);

        CryptoWithdrawal withdrawal = new CryptoWithdrawal();
        withdrawal.setUserId(idt.getUserId());
        withdrawal.setCurrency(idt.getCurrency().toUpperCase());
        withdrawal.setAmount(idt.getAmount());
        withdrawal.setToAddress(idt.getToAddress());
        withdrawal.setStatus("PENDING");
        withdrawal.setConfirmations(0);
        withdrawal.setCreatedAt(LocalDateTime.now());
        withdrawal.setUpdatedAt(LocalDateTime.now());

        return cryptoWithdrawalRepository.save(withdrawal);
    }

    /**
     * 대기 중인 출금 요청을 승인하고 온체인 네트워크로 트랜잭션을 전송(시뮬레이션)한다.
     *
     * @param id 승인하고자 하는 출금 신청 ID
     * @return 승인되어 브로드캐스트 처리된 출금 내역
     */
    @Transactional
    public CryptoWithdrawal approveWithdrawal(Long id) throws Exception {
        CryptoWithdrawal withdrawal = cryptoWithdrawalRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Not Found"));

        if (!withdrawal.getStatus().equals("PENDING")) {
            throw new IllegalStateException("Only PENDING requests can be approved.");
        }

        SystemHotWallet hotWallet = systemHotWalletRepository.findByCurrency(withdrawal.getCurrency().toUpperCase())
                .orElse(null);
        if (hotWallet == null || hotWallet.getBalance().compareTo(withdrawal.getAmount()) < 0) {
            throw new IllegalArgumentException("Insufficient hot wallet on-chain balance.");
        }

        String txHash;
        if (withdrawal.getCurrency().equalsIgnoreCase("JAF")) {
            if (jafTokenService.isInitialized()) {
                txHash = jafTokenService.transfer(withdrawal.getToAddress(), withdrawal.getAmount());
            } else {
                throw new IllegalStateException("JAFTokenService is not initialized yet.");
            }
        } else {
            txHash = "0x" + UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "").substring(0, 32);
        }

        withdrawal.setTxHash(txHash);
        withdrawal.setStatus("BROADCASTED");
        withdrawal.setConfirmations(0);
        withdrawal.setUpdatedAt(LocalDateTime.now());

        CryptoWithdrawal saved = cryptoWithdrawalRepository.save(withdrawal);
        log.info("[출금 승인] 출금 ID: {} 승인 완료. TxHash 생성: {}", id, txHash);
        return saved;
    }

    /**
     * 대기 중인 출금 요청을 반려하고 유저의 잠금 자산을 다시 복구한다.
     *
     * @param id 반려하고자 하는 출금 신청 ID
     * @return 반려 완료된 출금 내역
     */
    @Transactional
    public CryptoWithdrawal rejectWithdrawal(Long id) {
        CryptoWithdrawal withdrawal = cryptoWithdrawalRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Not Found"));

        if (!withdrawal.getStatus().equals("PENDING")) {
            throw new IllegalStateException("Only PENDING requests can be rejected.");
        }

        withdrawal.setStatus("REJECTED");
        withdrawal.setUpdatedAt(LocalDateTime.now());
        cryptoWithdrawalRepository.save(withdrawal);

        Wallet wallet = walletRepository.findByUserIdAndCurrency(withdrawal.getUserId(), withdrawal.getCurrency())
                .orElse(null);
        if (wallet != null) {
            BigDecimal nextLocked = wallet.getLockedBalance().subtract(withdrawal.getAmount());
            if (nextLocked.compareTo(BigDecimal.ZERO) < 0) {
                nextLocked = BigDecimal.ZERO;
            }

            wallet.setLockedBalance(nextLocked);
            wallet.setBalance(wallet.getBalance().add(withdrawal.getAmount()));
            wallet.setUpdatedAt(LocalDateTime.now());
            walletRepository.save(wallet);
        }

        return withdrawal;
    }

    /**
     * 시스템 핫월렛에 자산을 리밸런싱(수동 충전)한다.
     *
     * @param id 핫월렛 ID
     * @param idt 충전 요청 DTO
     * @return 충전 완료된 핫월렛 정보
     */
    @Transactional
    public SystemHotWallet rebalanceHotWallet(Long id, RebalanceRequestIDT idt) {
        SystemHotWallet hotWallet = systemHotWalletRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Not Found"));

        if (idt.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Rebalance amount must be positive");
        }

        hotWallet.setBalance(hotWallet.getBalance().add(idt.getAmount()));
        hotWallet.setUpdatedAt(LocalDateTime.now());
        SystemHotWallet saved = systemHotWalletRepository.save(hotWallet);

        log.info("[핫월렛 충전] {} 핫월렛에 {} 가 충전되었습니다.", hotWallet.getCurrency(), idt.getAmount());
        return saved;
    }
}
