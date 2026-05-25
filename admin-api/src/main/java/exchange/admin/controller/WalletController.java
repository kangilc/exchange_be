package exchange.admin.controller;

import exchange.admin.model.Wallet;
import exchange.admin.repository.WalletRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/wallets")
@CrossOrigin(origins = "*")
public class WalletController {

    @Autowired
    private WalletRepository walletRepository;

    @GetMapping
    public ResponseEntity<List<Wallet>> getAllWallets() {
        return ResponseEntity.ok(walletRepository.findAll());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Wallet>> getWalletsByUserId(@PathVariable Long userId) {
        return ResponseEntity.ok(walletRepository.findByUserId(userId));
    }

    @GetMapping("/summary")
    public ResponseEntity<List<WalletRepository.CurrencySummary>> getWalletSummary() {
        return ResponseEntity.ok(walletRepository.getCurrencySummary());
    }
}
