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
    public ResponseEntity<org.springframework.data.domain.Page<LedgerJournalRepository.DetailedLedgerProjection>> getAllDetailedLedgers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        String searchParam = (search != null && !search.trim().isEmpty()) ? "%" + search.trim() + "%" : null;
        return ResponseEntity.ok(ledgerJournalRepository.findAllDetailedLedgers(searchParam, org.springframework.data.domain.PageRequest.of(page, size)));
    }
}
