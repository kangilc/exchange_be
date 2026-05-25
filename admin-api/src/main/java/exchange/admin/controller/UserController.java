package exchange.admin.controller;

import exchange.admin.model.User;
import exchange.admin.model.Wallet;
import exchange.admin.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/users")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<User> registerUser(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String password = request.get("password");
        String grade = request.get("grade");
        
        if (email == null || password == null) {
            return ResponseEntity.badRequest().build();
        }
        
        User registeredUser = userService.registerUser(email, password, grade);
        return ResponseEntity.ok(registeredUser);
    }

    @PutMapping("/{id}")
    public ResponseEntity<User> updateUser(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String email = request.get("email");
        String status = request.get("status");
        String grade = request.get("grade");
        
        return userService.updateUser(id, email, status, grade)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/assets/adjust")
    public ResponseEntity<?> adjustAsset(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String currency = (String) request.get("currency");
        Object amountObj = request.get("amount");
        
        if (currency == null || amountObj == null) {
            return ResponseEntity.badRequest().body("Required fields: 'currency' and 'amount'");
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(amountObj.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid amount format");
        }

        try {
            Wallet updatedWallet = userService.adjustAsset(id, currency, amount);
            return ResponseEntity.ok(updatedWallet);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    @Autowired
    private exchange.admin.repository.TradeRepository tradeRepository;

    @Autowired
    private exchange.admin.repository.LedgerJournalRepository ledgerJournalRepository;

    @GetMapping("/{id}/trades")
    public ResponseEntity<List<exchange.admin.repository.TradeRepository.UserTradeProjection>> getUserTrades(@PathVariable Long id) {
        return ResponseEntity.ok(tradeRepository.findUserTrades(id));
    }

    @GetMapping("/{id}/ledgers")
    public ResponseEntity<List<exchange.admin.repository.LedgerJournalRepository.DetailedLedgerProjection>> getUserLedgers(@PathVariable Long id) {
        return ResponseEntity.ok(ledgerJournalRepository.findDetailedLedgersByUserId(id));
    }
}
