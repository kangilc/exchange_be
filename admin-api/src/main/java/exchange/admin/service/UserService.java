package exchange.admin.service;

import exchange.admin.model.LedgerJournal;
import exchange.admin.model.User;
import exchange.admin.model.Wallet;
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

    @Transactional
    public User registerUser(String email, String password, String grade) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setGrade(grade != null ? grade : "STANDARD");
        user.setStatus("ACTIVE");
        
        User savedUser = userRepository.save(user);

        initializeWallet(savedUser.getUserId(), "KRW");
        initializeWallet(savedUser.getUserId(), "BTC");
        initializeWallet(savedUser.getUserId(), "ADA");
        initializeWallet(savedUser.getUserId(), "USD");

        return savedUser;
    }

    @Transactional
    public Optional<User> updateUser(Long id, String email, String status, String grade) {
        return userRepository.findById(id).map(user -> {
            if (email != null) user.setEmail(email);
            if (status != null) user.setStatus(status);
            if (grade != null) user.setGrade(grade);
            return userRepository.save(user);
        });
    }

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
