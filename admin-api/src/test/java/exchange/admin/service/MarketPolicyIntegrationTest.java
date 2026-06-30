package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.config.AdminSettings;
import exchange.admin.model.Market;
import exchange.admin.model.MarketHistory;
import exchange.admin.repository.MarketHistoryRepository;
import exchange.admin.repository.MarketRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 수수료 정책 변경, 상장 마켓 속성 갱신 및 변경 이력(MarketHistory) 관리 정합성 통합 검증 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용함.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MarketPolicyIntegrationTest extends BaseIntegrationTest {

    private final MarketService marketService;
    private final MarketRepository marketRepository;
    private final MarketHistoryRepository marketHistoryRepository;

    public MarketPolicyIntegrationTest(MarketService marketService,
                                       MarketRepository marketRepository,
                                       MarketHistoryRepository marketHistoryRepository) {
        this.marketService = marketService;
        this.marketRepository = marketRepository;
        this.marketHistoryRepository = marketHistoryRepository;
    }

    @Test
    @Order(1)
    @Transactional
    @DisplayName("1. 특정 마켓의 수수료율을 수정했을 때 DB 상태 저장, 감사 이력(MarketHistory) 적재, 인메모리 수수료 캐시(AdminSettings) 동적 실시간 동기화를 검증")
    void test01_updateMarketFee_Success() {
        // 테스트용 마켓 생성 및 저장
        Market market = new Market();
        market.setSymbol("BTC-KRW");
        market.setBaseCurrency("BTC");
        market.setQuoteCurrency("KRW");
        market.setFeeRate(new BigDecimal("0.001000")); // 기본 0.1%
        market.setStatus("ACTIVE");
        marketRepository.save(market);
        marketRepository.flush();

        // 수수료율 0.25%로 수정 호출
        marketService.updateMarketFee("BTC-KRW", 0.0025);

        // 1) DB 상태 검증
        Market dbMarket = marketRepository.findById("BTC-KRW").orElseThrow();
        assertThat(dbMarket.getFeeRate()).isEqualByComparingTo(new BigDecimal("0.0025"));

        // 2) 인메모리 수수료 캐시(AdminSettings) 실시간 반영 검증
        double cachedFee = AdminSettings.getFeeRate("BTC-KRW");
        assertThat(cachedFee).isEqualTo(0.0025);

        // 3) 감사 이력(MarketHistory) 테이블 적재 검증
        List<MarketHistory> histories = marketHistoryRepository.findAll();
        assertThat(histories).hasSize(1);
        MarketHistory hist = histories.get(0);
        assertThat(hist.getSymbol()).isEqualTo("BTC-KRW");
        assertThat(hist.getFeeRate()).isEqualByComparingTo(new BigDecimal("0.0025"));
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("2. 마켓의 여러 정책 변수(상태, 소수점 자릿수, 최소 주문액 등)를 일괄 업데이트했을 때 DB 변경과 이력 적재가 올바르게 수행되는지 검증")
    void test02_updateMarket_FullUpdate_Success() {
        Market market = new Market();
        market.setSymbol("ETH-KRW");
        market.setBaseCurrency("ETH");
        market.setQuoteCurrency("KRW");
        market.setStatus("ACTIVE");
        market.setPriceDecimals(4);
        marketRepository.save(market);
        marketRepository.flush();

        // 업데이트 데이터 설정
        Market updateData = new Market();
        updateData.setStatus("PAUSED");
        updateData.setPriceDecimals(8);
        updateData.setMinAmt(new BigDecimal("0.005"));

        // 마켓 일괄 정보 변경 실행
        marketService.updateMarket("ETH-KRW", updateData);

        // DB 갱신 검증
        Market dbMarket = marketRepository.findById("ETH-KRW").orElseThrow();
        assertThat(dbMarket.getStatus()).isEqualTo("PAUSED");
        assertThat(dbMarket.getPriceDecimals()).isEqualTo(8);
        assertThat(dbMarket.getMinAmt()).isEqualByComparingTo(new BigDecimal("0.005"));

        // 이력 적재 검증
        List<MarketHistory> histories = marketHistoryRepository.findAll();
        assertThat(histories).anyMatch(h -> h.getSymbol().equals("ETH-KRW") && h.getStatus().equals("PAUSED"));
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("3. 활성(ACTIVE) 상태 마켓만 필터링되어 조회되는지 검증")
    void test03_getActiveMarkets_Success() {
        // 활성 마켓 1건 생성
        Market active = new Market();
        active.setSymbol("ADA-KRW");
        active.setBaseCurrency("ADA");
        active.setQuoteCurrency("KRW");
        active.setStatus("ACTIVE");
        marketRepository.save(active);

        // 비활성 마켓 1건 생성
        Market inactive = new Market();
        inactive.setSymbol("XRP-KRW");
        inactive.setBaseCurrency("XRP");
        inactive.setQuoteCurrency("KRW");
        inactive.setStatus("INACTIVE");
        marketRepository.save(inactive);
        
        marketRepository.flush();

        // 조회 실행
        List<Market> list = marketService.getActiveMarkets();

        // 활성 상태만 포함하고 비활성 상태는 불포함함을 검증
        assertThat(list).anyMatch(m -> m.getSymbol().equals("ADA-KRW"));
        assertThat(list).noneMatch(m -> m.getSymbol().equals("XRP-KRW"));
    }

    @Test
    @Order(4)
    @Transactional
    @DisplayName("4. 존재하지 않는 마켓 심볼을 단건 조회할 때 결과가 비어있는지 확인")
    void test04_getMarket_NotFound() {
        Optional<Market> result = marketService.getMarket("FAKE-MARKET");
        assertThat(result).isEmpty();
    }
}
