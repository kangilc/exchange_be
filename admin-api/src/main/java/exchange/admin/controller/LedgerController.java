package exchange.admin.controller;

import exchange.admin.repository.LedgerJournalRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/ledgers")
@CrossOrigin(origins = "*")
public class LedgerController {

    @Autowired
    private LedgerJournalRepository ledgerJournalRepository;

    @GetMapping
    public ResponseEntity<List<LedgerJournalRepository.DetailedLedgerProjection>> getAllDetailedLedgers() {
        return ResponseEntity.ok(ledgerJournalRepository.findAllDetailedLedgers());
    }
}
