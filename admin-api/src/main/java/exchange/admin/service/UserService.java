package exchange.admin.service;

import exchange.admin.model.LedgerJournal;
import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.model.constant.UserGrade;
import exchange.admin.repository.LedgerJournalRepository;
import exchange.admin.repository.UserRepository;
import exchange.admin.repository.WalletRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 회원 가입, 계정 정보 수정, 회원의 가상 지갑 자산 조정 및 분개장 원장 기록 등을 담당하는 서비스 클래스입니다.
 */
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private WalletRepository walletRepository;

    @Autowired
    private LedgerJournalRepository ledgerJournalRepository;

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    /**
     * 신규 회원을 등록하고 해당 회원의 기초 지갑 자산(KRW, BTC, ADA, USD)을 초기화합니다.
     * 
     * @param email 가입 이메일
     * @param password 비밀번호 (인코딩하여 해싱 저장됨)
     * @param grade 회원 등급 (ADMIN, STANDARD 등)
     * @return 등록 완료된 회원 객체
     */
    @Transactional
    public User registerUser(String email, String password, String grade) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        // String 타입을 UserGrade Enum 타입으로 변환하여 저장
        user.setGrade(grade != null ? UserGrade.valueOf(grade.toUpperCase()) : UserGrade.STANDARD);
        user.setStatus("ACTIVE");
        
        User savedUser = userRepository.save(user);

        initializeWallet(savedUser.getUserId(), "KRW");
        initializeWallet(savedUser.getUserId(), "BTC");
        initializeWallet(savedUser.getUserId(), "ADA");
        initializeWallet(savedUser.getUserId(), "USD");

        return savedUser;
    }

    /**
     * 회원의 특정 정보(이메일, 상태, 등급)를 수정합니다.
     * 
     * @param id 회원 ID
     * @param email 변경할 이메일
     * @param status 변경할 상태
     * @param grade 변경할 등급
     * @return 수정 결과 User 객체 Optional
     */
    @Transactional
    public Optional<User> updateUser(Long id, String email, String status, String grade) {
        return userRepository.findById(id).map(user -> {
            if (email != null) user.setEmail(email);
            if (status != null) user.setStatus(status);
            // String 타입을 UserGrade Enum 타입으로 변환하여 저장
            if (grade != null) user.setGrade(UserGrade.valueOf(grade.toUpperCase()));
            return userRepository.save(user);
        });
    }

    /**
     * 회원의 특정 통화 자산 잔고를 수동으로 조정(가산/감산)하고, 원장 분개장(LedgerJournal)에 변경 이력을 기록합니다.
     * 
     * @param userId 회원 ID
     * @param currency 대상 통화 코드
     * @param amount 조정할 금액 (음수 가능)
     * @return 잔고 조정이 반영된 최종 Wallet 객체
     * @throws IllegalArgumentException 차감액이 가용 잔고보다 클 경우 예외 발생
     */
    @Transactional
    public Wallet adjustAsset(Long userId, String currency, BigDecimal amount) {
        Wallet wallet = walletRepository.findByUserIdAndCurrency(userId, currency)
                .orElseGet(() -> {
                    Wallet w = new Wallet();
                    w.setUserId(userId);
                    w.setCurrency(currency.toUpperCase());
                    w.setBalance(BigDecimal.ZERO);
                    w.setLockedBalance(BigDecimal.ZERO);
                    w.setUpdatedAt(LocalDateTime.now());
                    return w;
                });

        BigDecimal newBalance = wallet.getBalance().add(amount);
        if (newBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Insufficient balance: adjustment would result in a negative balance (" + newBalance + ")");
        }
        
        wallet.setBalance(newBalance);
        wallet.setUpdatedAt(LocalDateTime.now());
        Wallet savedWallet = walletRepository.save(wallet);

        LedgerJournal journal = new LedgerJournal();
        journal.setUserId(userId);
        journal.setCurrency(currency.toUpperCase());
        journal.setAmount(amount);
        journal.setType(amount.compareTo(BigDecimal.ZERO) >= 0 ? "DEPOSIT" : "WITHDRAWAL");
        journal.setReferenceId(null);
        journal.setCreatedAt(LocalDateTime.now());
        ledgerJournalRepository.save(journal);

        return savedWallet;
    }

    private void initializeWallet(Long userId, String currency) {
        Wallet w = new Wallet();
        w.setUserId(userId);
        w.setCurrency(currency);
        w.setBalance(BigDecimal.ZERO);
        w.setLockedBalance(BigDecimal.ZERO);
        w.setUpdatedAt(LocalDateTime.now());
        walletRepository.save(w);
    }

    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return password; // Fallback
        }
    }
}
