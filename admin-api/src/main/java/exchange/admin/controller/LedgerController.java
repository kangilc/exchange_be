package exchange.admin.controller;

import exchange.admin.dto.ApiResponse;
import exchange.admin.dto.response.DetailedLedgerODT;
import exchange.admin.mapper.LedgerJournalMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    private final LedgerJournalMapper ledgerJournalMapper;

    // 생성자 주입
    public LedgerController(LedgerJournalMapper ledgerJournalMapper) {
        this.ledgerJournalMapper = ledgerJournalMapper;
    }

    /**
     * 입출금 및 자산 변경 원장 상세 내역 조회 API.
     * 검색 키워드(이메일, 자산 코드 등), 날짜 필터링, 페이지네이션을 지원한다.
     *
     * @param search 검색어 (이메일 주소, 통화 단위 등, 선택 사항)
     * @param startDate 조회 시작일
     * @param endDate 조회 종료일
     * @param page   조회할 페이지 번호 (0부터 시작, 기본값 0)
     * @param size   한 페이지당 데이터 개수 (기본값 50)
     * @return 원장 내역 및 페이징 정보 목록
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<DetailedLedgerODT>>> getAllDetailedLedgers(
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(value = "startDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startDate,
            @RequestParam(value = "endDate", required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime endDate,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "50") int size) {
            
        java.time.LocalDateTime finalEndDate = endDate != null ? endDate : java.time.LocalDateTime.now();
        java.time.LocalDateTime finalStartDate = startDate != null ? startDate : finalEndDate.minusDays(30);
        
        int offset = page * size;
        List<DetailedLedgerODT> list = ledgerJournalMapper.selectDetailedLedgers(search, finalStartDate, finalEndDate, offset, size);
        long total = ledgerJournalMapper.countDetailedLedgers(search, finalStartDate, finalEndDate);
        
        Page<DetailedLedgerODT> pageResult = new PageImpl<>(list, PageRequest.of(page, size), total);
        return ApiResponse.ok(pageResult);
    }
}
