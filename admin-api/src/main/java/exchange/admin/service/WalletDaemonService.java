package exchange.admin.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.web3j.utils.Numeric;

/**
 * <h1>WalletDaemonService</h1>
 * 가상 온체인 블록체인 네트워크의 동작을 시뮬레이션하는 백그라운드 데몬 서비스입니다.
 * <p>
 * 실환경의 비트코인(BTC), 이더리움(ETH), 에이다(ADA) 노드 및 RPC 연동 없이,
 * 주기적으로 블록 높이(Block Height)를 증가시키고 입출금 트랜잭션의 블록 확인(Confirmation)을 수행합니다.
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WalletDaemonService {

    private final CryptoWithdrawalRepository cryptoWithdrawalRepository;
    private final SystemHotWalletRepository systemHotWalletRepository;
    private final UserCryptoAddressRepository userCryptoAddressRepository;
    private final WalletRepository walletRepository;
    private final LedgerJournalRepository ledgerJournalRepository;
    private final UserService userService;
    private final java.util.List<CoinNetworkService> coinNetworkServices;

    /** 임의의 입금 이벤트를 발생시키기 위한 난수 생성기 */
    private final Random random = new Random();

    /** 현재 블록체인 컨펌 단계에 진입하여 대기 중인 가상 입금 트랜잭션 대기열 (쓰기 안전한 동시성 리스트) */
    private final List<PendingDeposit> pendingDeposits = new CopyOnWriteArrayList<>();

    /** 시뮬레이션용 현재 가상 블록체인 높이 (초기 시드 번호에서 스케줄러당 1씩 증가) */
    private long simulatedBlockHeight = 12045300L;

    /** JAF, BTC, ADA 등의 블록체인 입금 감지를 위해 마지막으로 스캔한 블록 번호 맵 */
    private final java.util.Map<String, BigInteger> lastScannedBlocks = new ConcurrentHashMap<>();

    /** 이미 감지하여 처리 중이거나 완료된 온체인 입금 트랜잭션 해시 목록 (중복 처리 방지용) */
    private final Set<String> processedDepositTxHashes = ConcurrentHashMap.newKeySet();

    /**
     * <h2>PendingDeposit</h2>
     * 블록 컨펌 진행 중인 입금 트랜잭션 정보를 담는 내부 데이터 모델입니다.
     */
    public static class PendingDeposit {
        /** 입금 대상 사용자의 고유 UID */
        private final Long userId;
        /** 입금 화폐 구분 (BTC, ETH, ADA) */
        private final String currency;
        /** 입금 수량 */
        private final BigDecimal amount;
        /** 가상으로 생성된 온체인 트랜잭션 해시 (TXID) */
        private final String txHash;
        /** 입금이 감지된 사용자의 온체인 수신 주소 */
        private final String cryptoAddress;
        /** 현재까지 진행된 블록 확인 횟수 (Confirmations) */
        private int confirmations;
        /** 입금 확정을 위해 요구되는 최소 블록 확인 임계값 */
        private final int requiredConfirmations;
        /** 가상 입금이 최초 감지되어 대기열에 등록된 일시 */
        private final LocalDateTime createdAt;

        public PendingDeposit(Long userId, String currency, BigDecimal amount, String txHash, String cryptoAddress,
                int requiredConfirmations) {
            this.userId = userId;
            this.currency = currency;
            this.amount = amount;
            this.txHash = txHash;
            this.cryptoAddress = cryptoAddress;
            this.confirmations = 0;
            this.requiredConfirmations = requiredConfirmations;
            this.createdAt = LocalDateTime.now();
        }

        public Long getUserId() {
            return userId;
        }

        public String getCurrency() {
            return currency;
        }

        public BigDecimal getAmount() {
            return amount;
        }

        public String getTxHash() {
            return txHash;
        }

        public String getCryptoAddress() {
            return cryptoAddress;
        }

        public int getConfirmations() {
            return confirmations;
        }

        /** 블록이 새로 생성될 때마다 트랜잭션의 컨펌수를 1씩 증가시킵니다. */
        public void incrementConfirmations() {
            this.confirmations++;
        }

        public int getRequiredConfirmations() {
            return requiredConfirmations;
        }

        public LocalDateTime getCreatedAt() {
            return createdAt;
        }
    }

    /**
     * @return 현재 컨펌이 완료되지 않고 대기 중인 모든 가상 입금 목록을 반환합니다.
     */
    public List<PendingDeposit> getPendingDeposits() {
        return new ArrayList<>(pendingDeposits);
    }

    /**
     * @return 현재 가상 블록체인의 높이(Block Height)를 반환합니다.
     */
    public long getSimulatedBlockHeight() {
        return simulatedBlockHeight;
    }

    /**
     * <h2>processBlockGenerations</h2>
     * 5초 주기로 백그라운드에서 실행되며 가상의 블록 생성을 트리거합니다.
     * <ol>
     * <li>가상 블록 번호를 1 증가시킵니다.</li>
     * <li>5%의 확률로 임의의 입금 이벤트를 시뮬레이션하여 대기열에 추가합니다.</li>
     * <li>대기 중인 가상 입금들의 컨펌수를 증가시키고, 완료 시 자산에 반영합니다.</li>
     * <li>승인되어 브로드캐스트된 출금 트랜잭션의 컨펌수를 증가시키고, 완료 시 자산 잠금을 해제하고 핫월렛에서 차감합니다.</li>
     * </ol>
     */
    @Scheduled(fixedDelay = 5000)
    @Transactional
    public void processBlockGenerations() {
        simulatedBlockHeight++;

        // 5%의 확률로 임의의 사용자에게 입금 이벤트 시뮬레이션 수행
        if (random.nextInt(100) < 5) {
            simulateIncomingDeposit();
        }

        // 실제 온체인 상의 입금(JAF, BTC, ADA 토큰 등) 감지 및 대기 중인 입금의 컨펌(블록 확인) 처리는
        // 시뮬레이터 ON/OFF 여부와 관계없이 실시간으로 계속 수행됩니다.
        scanOnChainDeposits();
        processPendingDeposits();

        // 3. 가상 출금(Withdrawal) 컨펌 수 가산 및 최종 성공 완료 처리
        processPendingWithdrawals();
    }

    /**
     * <h2>simulateIncomingDeposit</h2>
     * 등록된 유저들의 지갑 주소 DB를 조회하여 임의로 입금 감지 이벤트를 발송합니다.
     */
    private void simulateIncomingDeposit() {
        List<UserCryptoAddress> allAddresses = userCryptoAddressRepository.findAll();
        if (allAddresses.isEmpty())
            return;

        // DB에 발급되어 있는 주소 중 무작위로 대상 주소 1개를 선택
        UserCryptoAddress targetAddr = allAddresses.get(random.nextInt(allAddresses.size()));

        // 통화별 가격 및 수량 범위 설정
        BigDecimal amount;
        String currency = targetAddr.getCurrency();

        if (currency.equals("JAF") || currency.equals("BTC") || currency.equals("ADA")) {
            // 온체인 입금 모니터링 활성화 여부 검사
            if (!AdminSettings.isOnChainDepositMonitoringEnabled()) {
                return;
            }
            amount = BigDecimal.valueOf(10 + random.nextInt(90)).setScale(8, RoundingMode.HALF_UP);

            // 해당 자산의 코인 서비스 조회
            CoinNetworkService networkService = coinNetworkServices.stream()
                    .filter(s -> s.supports(currency))
                    .findFirst()
                    .orElse(null);

            // 실물 토큰의 경우, 핫월렛(Account 0)에서 사용자 주소로 실제 온체인 트랜잭션을 전송
            try {
                if (networkService != null && networkService.isInitialized()) {
                    log.info("[블록체인 시뮬레이터] 시뮬레이션 입금을 위한 {} 온체인 전송 수행...", currency);
                    String txHash = networkService.transfer(targetAddr.getCryptoAddress(), amount);
                    log.info("[블록체인 시뮬레이터] {} 온체인 전송 완료. TxHash: {}", currency, txHash);
                    // 온체인 전송 성공 시, block scanner가 이 트랜잭션을 다음 블록에서 감지할 것이므로
                    // 여기서는 pendingDeposits에 직접 넣지 않고 온체인 이벤트를 스캔하도록 리턴
                    return;
                } else {
                    log.error("[블록체인 시뮬레이터] 코인 서비스가 초기화되지 않아 {} 입금 시뮬레이션을 건너뜁니다.", currency);
                    return;
                }
            } catch (Exception e) {
                log.error("[블록체인 시뮬레이터] {} 온체인 전송 실패: {}", currency, e.getMessage());
                return;
            }
        } else {
            return; // 지원하지 않는 통화 무시
        }
    }

    /**
     * <h2>processPendingDeposits</h2>
     * 현재 컨펌 중인 입금 내역의 블록 확인수를 증가시키고, 기준 충족 시 실제 잔고에 정산합니다.
     */
    private void processPendingDeposits() {
        List<PendingDeposit> completed = new ArrayList<>();

        for (PendingDeposit dep : pendingDeposits) {
            dep.incrementConfirmations();
            if (dep.getConfirmations() >= dep.getRequiredConfirmations()) {
                // 1. 유저 가상 잔고 증가 및 거래소 저널 기록
                try {
                    userService.adjustAsset(dep.getUserId(), dep.getCurrency(), dep.getAmount());
                    completed.add(dep);
                    log.info("[블록체인 시뮬레이터] 입금 컨펌 완료! User {} / {} {} -> 가상 지갑 정산 성공",
                            dep.getUserId(), dep.getAmount(), dep.getCurrency());
                } catch (Exception e) {
                    log.error("Failed to credit pending deposit: {}", e.getMessage());
                }
            }
        }

        // 완료 처리된 트랜잭션은 대기열에서 안전하게 소멸시킵니다.
        pendingDeposits.removeAll(completed);
    }

    /**
     * <h2>processPendingWithdrawals</h2>
     * 어드민에 의해 승인되어 브로드캐스트 상태가 된 가상 출금들의 컨펌수를 증가시키고, 최종 성공 처리합니다.
     */
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
            } else if (withdrawal.getCurrency().equalsIgnoreCase("JAF")) {
                reqConfirmations = AdminSettings.getEthConfirmations();
            }

            if (currentConfirmations >= reqConfirmations) {
                // 최종 승인 처리
                withdrawal.setStatus("SUCCESS");

                // 1. 유저의 가상 지갑 잠금 잔고 소멸
                Wallet wallet = walletRepository
                        .findByUserIdAndCurrency(withdrawal.getUserId(), withdrawal.getCurrency())
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
                SystemHotWallet hotWallet = systemHotWalletRepository
                        .findByCurrency(withdrawal.getCurrency().toUpperCase())
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

                log.info("[블록체인 시뮬레이터] 출금 완료! ID: {} / {} {} 송금 최종 성공",
                        withdrawal.getWithdrawalId(), withdrawal.getAmount(), withdrawal.getCurrency());
            }

            cryptoWithdrawalRepository.save(withdrawal);
        }
    }

    private void scanOnChainDeposits() {
        for (CoinNetworkService service : coinNetworkServices) {
            if (!service.isInitialized()) {
                continue;
            }

            String currency = "JAF";
            if (service.supports("BTC")) {
                currency = "BTC";
            } else if (service.supports("ADA")) {
                currency = "ADA";
            }

            try {
                // JafCoinService, BtcCoinService, AdaCoinService의 내부 web3j를 사용해 온체인 로그 추출
                // 각 구현체는 Web3j를 통해 원격 블록 정보를 스캔하도록 수정
                org.web3j.protocol.Web3j web3j = null;
                if (service instanceof JafCoinService) {
                    web3j = org.web3j.protocol.Web3j.build(new org.web3j.protocol.http.HttpService(
                            AdminSettings.isOnChainDepositMonitoringEnabled() ? "http://ganache:8545" : "http://localhost:8545"));
                } else if (service instanceof BtcCoinService) {
                    web3j = org.web3j.protocol.Web3j.build(new org.web3j.protocol.http.HttpService(
                            AdminSettings.isOnChainDepositMonitoringEnabled() ? "http://ganache:8545" : "http://localhost:8545"));
                } else if (service instanceof AdaCoinService) {
                    web3j = org.web3j.protocol.Web3j.build(new org.web3j.protocol.http.HttpService(
                            AdminSettings.isOnChainDepositMonitoringEnabled() ? "http://ganache:8545" : "http://localhost:8545"));
                }

                if (web3j == null) {
                    continue;
                }

                BigInteger latestBlock = web3j.ethBlockNumber().send().getBlockNumber();
                BigInteger lastScannedBlock = lastScannedBlocks.get(currency);

                if (lastScannedBlock == null) {
                    lastScannedBlocks.put(currency, latestBlock);
                    log.info("[WalletDaemonService] 온체인 {} 블록 스캐너가 블록 {}에서 초기화되었습니다.", currency, latestBlock);
                    continue;
                }

                BigInteger fromBlock = lastScannedBlock.add(BigInteger.ONE);
                BigInteger toBlock = latestBlock;

                if (fromBlock.compareTo(toBlock) <= 0) {
                    org.web3j.protocol.core.methods.request.EthFilter filter = new org.web3j.protocol.core.methods.request.EthFilter(
                            new org.web3j.protocol.core.DefaultBlockParameterNumber(fromBlock),
                            new org.web3j.protocol.core.DefaultBlockParameterNumber(toBlock),
                            service.getContractAddress());
                    // ERC-20 Transfer(address,address,uint256) 이벤트 해시 필터링
                    filter.addSingleTopic("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef");

                    org.web3j.protocol.core.methods.response.EthLog ethLog = web3j.ethGetLogs(filter).send();
                    if (ethLog.hasError()) {
                        log.error("[WalletDaemonService] {} EthGetLogs 에러: {}", currency, ethLog.getError().getMessage());
                        continue;
                    }

                    List<org.web3j.protocol.core.methods.response.EthLog.LogResult> logs = ethLog.getLogs();
                    for (org.web3j.protocol.core.methods.response.EthLog.LogResult logResult : logs) {
                        org.web3j.protocol.core.methods.response.Log web3jLog = (org.web3j.protocol.core.methods.response.Log) logResult.get();
                        List<String> topics = web3jLog.getTopics();
                        if (topics.size() >= 3) {
                            String toAddress = "0x" + topics.get(2).substring(26);
                            String txHash = web3jLog.getTransactionHash();

                            // DB의 사용자 입금 주소 목록 매핑 시도
                            Optional<UserCryptoAddress> userAddrOpt = userCryptoAddressRepository
                                    .findByCryptoAddressIgnoreCase(toAddress);
                            if (userAddrOpt.isPresent()) {
                                UserCryptoAddress userAddr = userAddrOpt.get();
                                String userCurrency = userAddr.getCurrency().toUpperCase();

                                if (userCurrency.equalsIgnoreCase(currency)) {
                                    BigInteger value = Numeric.toBigInt(web3jLog.getData());
                                    BigDecimal amount = new BigDecimal(value).divide(BigDecimal.TEN.pow(18), 8, RoundingMode.HALF_UP);

                                    boolean alreadyPending = pendingDeposits.stream()
                                            .anyMatch(d -> d.getTxHash().equalsIgnoreCase(txHash));
                                    if (!alreadyPending && !processedDepositTxHashes.contains(txHash)) {
                                        int reqConfirmations = AdminSettings.getEthConfirmations();
                                        PendingDeposit deposit = new PendingDeposit(
                                                userAddr.getUserId(),
                                                userCurrency,
                                                amount,
                                                txHash,
                                                userAddr.getCryptoAddress(),
                                                reqConfirmations);
                                        pendingDeposits.add(deposit);
                                        processedDepositTxHashes.add(txHash);
                                        log.info(
                                                "[WalletDaemonService] 온체인 {} 입금 감지! TxHash: {}, 수량: {}, 수신처: {} -> 컨펌 대기 대기열 진입",
                                                userCurrency, txHash, amount, userAddr.getCryptoAddress());
                                    }
                                }
                            }
                        }
                    }
                    lastScannedBlocks.put(currency, toBlock);
                }
            } catch (Exception e) {
                log.error("[WalletDaemonService] 온체인 {} 입금 스캔 중 에러 발생: {}", currency, e.getMessage());
            }
        }
    }
}
