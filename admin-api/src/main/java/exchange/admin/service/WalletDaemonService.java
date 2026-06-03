package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.model.CryptoWithdrawal;
import exchange.admin.model.LedgerJournal;
import exchange.admin.model.SystemHotWallet;
import exchange.admin.model.UserCryptoAddress;
import exchange.admin.model.Wallet;
import exchange.admin.repository.CryptoWithdrawalRepository;
import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.SystemHotWalletRepository;
import exchange.admin.repository.UserCryptoAddressRepository;
import exchange.admin.repository.WalletRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class WalletDaemonService {

    @Autowired
    private CryptoWithdrawalRepository cryptoWithdrawalRepository;

    @Autowired
    private SystemHotWalletRepository systemHotWalletRepository;

    @Autowired
    private UserCryptoAddressRepository userCryptoAddressRepository;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private LedgerJournalRepository ledgerJournalRepository;

    @Autowired
    private UserService userService;

    private final Random random = new Random();
    private final List<PendingDeposit> pendingDeposits = new CopyOnWriteArrayList<>();
    private long simulatedBlockHeight = 12045300L;

    public static class PendingDeposit {
        private final Long userId;
        private final String currency;
        private final BigDecimal amount;
        private final String txHash;
        private final String cryptoAddress;
        private int confirmations;
        private final int requiredConfirmations;
        private final LocalDateTime createdAt;

        public PendingDeposit(Long userId, String currency, BigDecimal amount, String txHash, String cryptoAddress, int requiredConfirmations) {
            this.userId = userId;
            this.currency = currency;
            this.amount = amount;
            this.txHash = txHash;
            this.cryptoAddress = cryptoAddress;
            this.confirmations = 0;
            this.requiredConfirmations = requiredConfirmations;
            this.createdAt = LocalDateTime.now();
        }

        public Long getUserId() { return userId; }
        public String getCurrency() { return currency; }
        public BigDecimal getAmount() { return amount; }
        public String getTxHash() { return txHash; }
        public String getCryptoAddress() { return cryptoAddress; }
        public int getConfirmations() { return confirmations; }
        public void incrementConfirmations() { this.confirmations++; }
        public int getRequiredConfirmations() { return requiredConfirmations; }
        public LocalDateTime getCreatedAt() { return createdAt; }
    }

    public List<PendingDeposit> getPendingDeposits() {
        return new ArrayList<>(pendingDeposits);
    }

    public long getSimulatedBlockHeight() {
        return simulatedBlockHeight;
    }

    /**
     * 5초마다 가상의 블록 생성을 시뮬레이션하고, 입출금 트랜잭션의 컨펌수를 가산하여 완료 처리한다.
     */
    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void processBlockGenerations() {
        simulatedBlockHeight++;
        
        // 1. 가상 입금 생성 시뮬레이션 (5% 확률로 임의의 사용자에게 입금 이벤트 생성)
        if (random.nextInt(100) < 5) {
            simulateIncomingDeposit();
        }

        // 2. 가상 입금(Pending Deposit) 컨펌 수 가산 및 최종 처리
        processPendingDeposits();

        // 3. 가상 출금(Withdrawal) 컨펌 수 가산 및 최종 처리
        processPendingWithdrawals();
    }

    private void simulateIncomingDeposit() {
        List<UserCryptoAddress> allAddresses = userCryptoAddressRepository.findAll();
        if (allAddresses.isEmpty()) return;

        // 임의의 유저 지갑 주소 선택
        UserCryptoAddress targetAddr = allAddresses.get(random.nextInt(allAddresses.size()));
        
        // 통화별 가격 및 수량 범위 설정
        BigDecimal amount;
        int reqConfirmations;
        if (targetAddr.getCurrency().equals("BTC")) {
            amount = BigDecimal.valueOf(0.01 + random.nextDouble() * 0.15).setScale(8, RoundingMode.HALF_UP);
            reqConfirmations = AdminSettings.getBtcConfirmations();
        } else if (targetAddr.getCurrency().equals("ETH")) {
            amount = BigDecimal.valueOf(0.1 + random.nextDouble() * 2.0).setScale(8, RoundingMode.HALF_UP);
            reqConfirmations = AdminSettings.getEthConfirmations();
        } else if (targetAddr.getCurrency().equals("ADA")) {
            amount = BigDecimal.valueOf(50 + random.nextInt(450)).setScale(8, RoundingMode.HALF_UP);
            reqConfirmations = AdminSettings.getAdaConfirmations();
        } else {
            return; // 지원하지 않는 통화 무시
        }

        String txHash = "0x" + UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 32);
        
        PendingDeposit deposit = new PendingDeposit(
            targetAddr.getUserId(),
            targetAddr.getCurrency(),
            amount,
            txHash,
            targetAddr.getCryptoAddress(),
            reqConfirmations
        );

        pendingDeposits.add(deposit);
        System.out.println(String.format("[블록체인 시뮬레이터] 신규 가상 입금 감지! %s @ %s -> 컨펌 대기 시작 (Target: %d)", 
            amount, targetAddr.getCryptoAddress(), reqConfirmations));
    }

    private void processPendingDeposits() {
        List<PendingDeposit> completed = new ArrayList<>();

        for (PendingDeposit dep : pendingDeposits) {
            dep.incrementConfirmations();
            if (dep.getConfirmations() >= dep.getRequiredConfirmations()) {
                // 1. 유저 가상 잔고 증가 및 거래소 저널 기록
                try {
                    userService.adjustAsset(dep.getUserId(), dep.getCurrency(), dep.getAmount());
                    completed.add(dep);
                    System.out.println(String.format("[블록체인 시뮬레이터] 입금 컨펌 완료! User %d / %s %s -> 가상 지갑 정산 성공", 
                        dep.getUserId(), dep.getAmount(), dep.getCurrency()));
                } catch (Exception e) {
                    System.err.println("Failed to credit pending deposit: " + e.getMessage());
                }
            }
        }

        pendingDeposits.removeAll(completed);
    }

    private void processPendingWithdrawals() {
        // 출금 트랜잭션 중 BROADCASTED(블록체인 망에 전송되어 컨펌을 기다리는 상태) 조회
        List<CryptoWithdrawal> broadcasted = cryptoWithdrawalRepository.findByStatus("BROADCASTED");
        
        for (CryptoWithdrawal withdrawal : broadcasted) {
            int currentConfirmations = withdrawal.getConfirmations() + 1;
            withdrawal.setConfirmations(currentConfirmations);
            withdrawal.setUpdatedAt(LocalDateTime.now());

            int reqConfirmations = 3;
            if (withdrawal.getCurrency().equalsIgnoreCase("BTC")) {
                reqConfirmations = AdminSettings.getBtcConfirmations();
            } else if (withdrawal.getCurrency().equalsIgnoreCase("ETH")) {
                reqConfirmations = AdminSettings.getEthConfirmations();
            } else if (withdrawal.getCurrency().equalsIgnoreCase("ADA")) {
                reqConfirmations = AdminSettings.getAdaConfirmations();
            }

            if (currentConfirmations >= reqConfirmations) {
                // 최종 승인 처리
                withdrawal.setStatus("SUCCESS");
                
                // 1. 유저의 가상 지갑 잠금 잔고 소멸
                Wallet wallet = walletRepository.findByUserIdAndCurrency(withdrawal.getUserId(), withdrawal.getCurrency())
                        .orElse(null);
                if (wallet != null) {
                    BigDecimal nextLocked = wallet.getLockedBalance().subtract(withdrawal.getAmount());
                    if (nextLocked.compareTo(BigDecimal.ZERO) < 0) {
                        nextLocked = BigDecimal.ZERO;
                    }
                    wallet.setLockedBalance(nextLocked);
                    wallet.setUpdatedAt(LocalDateTime.now());
                    walletRepository.save(wallet);
                }

                // 2. 거래소 핫월렛 잔고 차감
                SystemHotWallet hotWallet = systemHotWalletRepository.findByCurrency(withdrawal.getCurrency().toUpperCase())
                        .orElse(null);
                if (hotWallet != null) {
                    BigDecimal nextBalance = hotWallet.getBalance().subtract(withdrawal.getAmount());
                    if (nextBalance.compareTo(BigDecimal.ZERO) < 0) {
                        nextBalance = BigDecimal.ZERO;
                    }
                    hotWallet.setBalance(nextBalance);
                    hotWallet.setUpdatedAt(LocalDateTime.now());
                    systemHotWalletRepository.save(hotWallet);
                }

                // 3. 거래 저널에 출금 완료 기재
                LedgerJournal journal = new LedgerJournal();
                journal.setUserId(withdrawal.getUserId());
                journal.setCurrency(withdrawal.getCurrency().toUpperCase());
                journal.setAmount(withdrawal.getAmount().negate());
                journal.setType("WITHDRAWAL");
                journal.setReferenceId(withdrawal.getWithdrawalId());
                journal.setCreatedAt(LocalDateTime.now());
                ledgerJournalRepository.save(journal);

                System.out.println(String.format("[블록체인 시뮬레이터] 출금 완료! ID: %d / %s %s 송금 최종 성공", 
                    withdrawal.getWithdrawalId(), withdrawal.getAmount(), withdrawal.getCurrency()));
            }
            
            cryptoWithdrawalRepository.save(withdrawal);
        }
    }
}
