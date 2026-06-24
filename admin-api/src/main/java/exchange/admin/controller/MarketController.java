package exchange.admin.controller;

import exchange.admin.model.Market;
import exchange.admin.repository.MarketRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ⚙️ 마켓 관리 컨트롤러 (MarketController)
 * 
 * - 거래소에 상장된 자산 마켓(예: BTC-USD, ADA-KRW)의 메타데이터 및 정책을 조회하고 설정하는 컨트롤러입니다.
 * - 일반 사용자의 활성 마켓 조회 기능 및 어드민의 수수료율, 소수점 자리수, 최소 거래량 등의 세부 설정 수정 기능을 제공합니다.
 */
@RestController
@RequestMapping("/admin/stats/markets")
@CrossOrigin(origins = "*")
public class MarketController {

    private final MarketRepository marketRepository;

    public MarketController(MarketRepository marketRepository) {
        this.marketRepository = marketRepository;
    }

    /**
     * 전체 상장된 활성 마켓 목록을 조회합니다.
     * 일반 유저/어드민 누구나 조회할 수 있도록 SecurityConfig에서 permitAll 설정합니다.
     */
    @GetMapping
    public ResponseEntity<List<Market>> getActiveMarkets() {
        return ResponseEntity.ok(marketRepository.findByStatus("ACTIVE"));
    }

    /**
     * 특정 마켓의 세부 구성 설정을 업데이트합니다.
     * 업데이트 가능한 항목:
     * - listingPrice: 상장 기준가 (소수점 보존을 위해 x100 배율 적용된 정수형 값)
     * - feeRate: 해당 마켓의 거래 수수료율 (예: 0.001 = 0.1%)
     * - priceDecimals: 호가 및 체결 표시 시 소수점 자릿수 한도
     * - minQty: 마켓에서 주문 가능한 최소 코인 수량 제한
     * - status: 마켓의 활성 상태 제어 (ACTIVE, INACTIVE 등)
     */
    @PutMapping("/{symbol}")
    public ResponseEntity<Market> updateMarket(
            @PathVariable("symbol") String symbol,
            @RequestBody Market updateData) {
        return marketRepository.findById(symbol)
                .map(market -> {
                    // 1. 상장 기준가 변경 사항 적용
                    if (updateData.getListingPrice() != null) {
                        market.setListingPrice(updateData.getListingPrice());
                    }
                    // 2. 수수료율 설정 변경 사항 적용
                    if (updateData.getFeeRate() != null) {
                        market.setFeeRate(updateData.getFeeRate());
                    }
                    // 3. 소수점 자릿수 제한 변경 사항 적용
                    if (updateData.getPriceDecimals() != null) {
                        market.setPriceDecimals(updateData.getPriceDecimals());
                    }
                    // 4. 최소 주문 수량 제한 변경 사항 적용
                    if (updateData.getMinQty() != null) {
                        market.setMinQty(updateData.getMinQty());
                    }
                    // 5. 마켓 상태 변경 사항 적용
                    if (updateData.getStatus() != null) {
                        market.setStatus(updateData.getStatus());
                    }
                    // 최종 수정본을 DB에 저장 후 응답
                    return ResponseEntity.ok(marketRepository.save(market));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
