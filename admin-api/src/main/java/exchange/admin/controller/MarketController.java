package exchange.admin.controller;

import exchange.admin.model.Market;
import exchange.admin.repository.MarketRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
     * 특정 마켓 설정을 업데이트합니다.
     */
    @PutMapping("/{symbol}")
    public ResponseEntity<Market> updateMarket(
            @PathVariable("symbol") String symbol,
            @RequestBody Market updateData) {
        return marketRepository.findById(symbol)
                .map(market -> {
                    if (updateData.getListingPrice() != null) {
                        market.setListingPrice(updateData.getListingPrice());
                    }
                    if (updateData.getFeeRate() != null) {
                        market.setFeeRate(updateData.getFeeRate());
                    }
                    if (updateData.getPriceDecimals() != null) {
                        market.setPriceDecimals(updateData.getPriceDecimals());
                    }
                    if (updateData.getMinQty() != null) {
                        market.setMinQty(updateData.getMinQty());
                    }
                    if (updateData.getStatus() != null) {
                        market.setStatus(updateData.getStatus());
                    }
                    return ResponseEntity.ok(marketRepository.save(market));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
