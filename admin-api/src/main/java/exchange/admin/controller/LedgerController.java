package exchange.admin.controller;

import exchange.admin.repository.LedgerJournalRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 어드민 자산 변경 이력(원장 분개장) 관리 컨트롤러.
 * 거래소 전체 혹은 특정 회원의 입출금 및 자산 변경 감사(Audit) 로그 조회를 제공한다.
 * 보안 가이드: 실제 배포 시에는 특정 신뢰할 수 있는 도메인(예: origins = "https://admin.exchange.com")만
 * 허용하도록 변경
 */
@RestController
@RequestMapping("/admin/ledgers")
@CrossOrigin(origins = "*")
public class LedgerController {

    private final LedgerJournalRepository ledgerJournalRepository;

    // 생성자 주입 (Spring 4.3+ 단일 생성자는 @Autowired 생략 가능)
    public LedgerController(LedgerJournalRepository ledgerJournalRepository) {
        this.ledgerJournalRepository = ledgerJournalRepository;
    }

    /**
     * 입출금 및 자산 변경 원장 상세 내역 조회 API.
     * 검색 키워드(이메일, 자산 코드 등)와 페이지네이션을 지원한다.
     *
     * @param search 검색어 (이메일 주소, 통화 단위 등, 선택 사항)
     * @param page   조회할 페이지 번호 (0부터 시작, 기본값 0)
     * @param size   한 페이지당 데이터 개수 (기본값 50)
     * @return 원장 내역 및 페이징 정보 목록
     */
    @GetMapping
    public ResponseEntity<org.springframework.data.domain.Page<LedgerJournalRepository.DetailedLedgerProjection>> getAllDetailedLedgers(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        // 검색 키워드가 있는 경우 앞뒤 공백을 제거하고 SQL LIKE 검색 패턴(%검색어%)을 빌드함
        String searchParam = (search != null && !search.trim().isEmpty()) ? "%" + search.trim() + "%" : null;

        // 페이징 요청 객체를 생성하여 DB에서 레코드 정보를 조회 및 반환함
        return ResponseEntity.ok(ledgerJournalRepository.findAllDetailedLedgers(searchParam,
                org.springframework.data.domain.PageRequest.of(page, size)));
    }
}
