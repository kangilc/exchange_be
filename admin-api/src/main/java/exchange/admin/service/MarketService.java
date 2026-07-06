package exchange.admin.service;

import exchange.admin.config.AdminSettings;
import exchange.admin.model.Market;
import exchange.admin.model.MarketHistory;
import exchange.admin.repository.MarketHistoryRepository;
import exchange.admin.repository.MarketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import exchange.admin.dto.request.stats.MarketUpdateIDT;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * 마켓 정보 및 상장 정책(수수료율, 소수점 자리수, 활성 상태 등)의 비즈니스 로직을 담당하는 서비스 클래스입니다.
 * 마켓 설정을 수정할 때 내역 이력(MarketHistory)을 함께 생성 및 영속화하며, AdminSettings 인메모리 수수료 캐시도 함께 동기화합니다.
 */
@Service
public class MarketService {

    private final MarketRepository marketRepository;
    private final MarketHistoryRepository marketHistoryRepository;

    /**
     * MarketService 생성자 주입.
     */
    public MarketService(MarketRepository marketRepository, MarketHistoryRepository marketHistoryRepository) {
        this.marketRepository = marketRepository;
        this.marketHistoryRepository = marketHistoryRepository;
    }

    /**
     * 활성화(ACTIVE) 상태인 마켓 목록 전체를 조회합니다.
     * 
     * @return 활성 마켓 목록
     */
    public List<Market> getActiveMarkets() {
        return marketRepository.findByStatus("ACTIVE");
    }

    /**
     * 활성화(ACTIVE) 상태인 마켓 목록을 페이징 조회합니다.
     * 
     * @param pageable 페이징 정보
     * @return 활성 마켓 목록 페이징 데이터
     */
    public Page<Market> getActiveMarkets(Pageable pageable) {
        return marketRepository.findByStatus("ACTIVE", pageable);
    }

    /**
     * 마켓 심볼을 바탕으로 마켓 단건 정보를 조회합니다.
     * 
     * @param symbol 마켓 심볼 (예: BTC-USD)
     * @return 마켓 정보 Optional
     */
    public Optional<Market> getMarket(String symbol) {
        return marketRepository.findById(symbol);
    }

    /**
     * 특정 마켓 설정을 업데이트하고 인메모리 수수료 캐시 동기화 및 이력(History) 기록을 수행합니다.
     * 
     * @param symbol 마켓 심볼
     * @param updateData 업데이트할 속성을 포함한 DTO 객체
     * @return 업데이트 완료된 마켓 객체
     */
    @Transactional
    public Market updateMarket(String symbol, MarketUpdateIDT updateData) {
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

    /**
     * 특정 마켓 설정을 업데이트하고 인메모리 수수료 캐시 동기화 및 이력(History) 기록을 수행합니다.
     * 
     * @param symbol 마켓 심볼
     * @param updateData 업데이트할 속성을 포함한 객체
     * @return 업데이트 완료된 마켓 객체
     */
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

    /**
     * 특정 마켓의 수수료율만 업데이트하고 캐시 동기화 및 이력 기록을 수행합니다.
     * 
     * @param symbol 마켓 심볼
     * @param rate 설정할 수수료율 수치
     */
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
