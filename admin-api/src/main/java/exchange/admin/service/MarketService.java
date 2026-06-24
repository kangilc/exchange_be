package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.model.Market;
import exchange.admin.model.MarketHistory;
import exchange.admin.repository.MarketHistoryRepository;
import exchange.admin.repository.MarketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class MarketService {

    private final MarketRepository marketRepository;
    private final MarketHistoryRepository marketHistoryRepository;

    public MarketService(MarketRepository marketRepository, MarketHistoryRepository marketHistoryRepository) {
        this.marketRepository = marketRepository;
        this.marketHistoryRepository = marketHistoryRepository;
    }

    public List<Market> getActiveMarkets() {
        return marketRepository.findByStatus("ACTIVE");
    }

    public Optional<Market> getMarket(String symbol) {
        return marketRepository.findById(symbol);
    }

    @Transactional
    public Market updateMarket(String symbol, Market updateData) {
        return marketRepository.findById(symbol)
                .map(market -> {
                    // 1. 상장 기준가 변경 사항 적용
                    if (updateData.getListingPrice() != null) {
                        market.setListingPrice(updateData.getListingPrice());
                    }
                    // 2. 수수료율 설정 변경 사항 적용
                    if (updateData.getFeeRate() != null) {
                        market.setFeeRate(updateData.getFeeRate());
                        // 인메모리 수수료율 캐시 동기화
                        AdminSettings.setFeeRate(symbol, updateData.getFeeRate().doubleValue());
                    }
                    // 3. 소수점 자릿수 제한 변경 사항 적용
                    if (updateData.getPriceDecimals() != null) {
                        market.setPriceDecimals(updateData.getPriceDecimals());
                    }
                    // 4. 최소 주문 금액 제한 변경 사항 적용
                    if (updateData.getMinAmt() != null) {
                        market.setMinAmt(updateData.getMinAmt());
                    }
                    // 5. 마켓 상태 변경 사항 적용
                    if (updateData.getStatus() != null) {
                        market.setStatus(updateData.getStatus());
                    }
                    
                    // 최종 수정본 DB 저장
                    Market saved = marketRepository.save(market);
                    
                    // JPA Auditing 필드가 반영될 수 있도록 명시적 flush 집행하여 시간/등록자 취득
                    marketRepository.flush();
                    
                    // market_histories 이력 테이블 기록
                    writeHistory(saved);
                    return saved;
                })
                .orElse(null);
    }

    @Transactional
    public void updateMarketFee(String symbol, double rate) {
        marketRepository.findById(symbol).ifPresent(market -> {
            BigDecimal feeRate = BigDecimal.valueOf(rate);
            market.setFeeRate(feeRate);
            AdminSettings.setFeeRate(symbol, rate);
            
            Market saved = marketRepository.save(market);
            marketRepository.flush();
            
            writeHistory(saved);
        });
    }

    private void writeHistory(Market market) {
        MarketHistory history = new MarketHistory();
        history.setSymbol(market.getSymbol());
        history.setFeeRate(market.getFeeRate());
        history.setPriceDecimals(market.getPriceDecimals());
        history.setMinAmt(market.getMinAmt());
        history.setStatus(market.getStatus());
        history.setCreatedAt(market.getCreatedAt());
        history.setUpdatedAt(market.getUpdatedAt());
        history.setCreatedBy(market.getCreatedBy());
        history.setUpdatedBy(market.getUpdatedBy());
        marketHistoryRepository.save(history);
    }
}
