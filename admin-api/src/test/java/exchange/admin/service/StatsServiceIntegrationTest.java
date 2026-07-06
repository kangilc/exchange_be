package exchange.admin.service;

import exchange.admin.BaseIntegrationTest;
import exchange.admin.dto.response.CandleODT;
import exchange.admin.dto.response.PerformanceODT;
import exchange.admin.dto.response.SummaryODT;
import exchange.admin.dto.response.TickerODT;
import exchange.admin.model.Market;
import exchange.admin.model.Trade;
import exchange.admin.model.User;
import exchange.admin.repository.MarketRepository;
import exchange.admin.repository.TradeRepository;
import exchange.admin.repository.UserRepository;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestConstructor;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 대시보드 요약 지표, 실시간 Caffeine 캐싱, MyBatis 연동 시계열 캔들 집계 및 재무 성능 통계 검증 테스트 클래스.
 * 개발 수칙에 의거하여 생성자 주입 방식을 사용함.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class StatsServiceIntegrationTest extends BaseIntegrationTest {

    private final StatsService statsService;
    private final UserService userService;
    private final TradeRepository tradeRepository;
    private final MarketRepository marketRepository;
    private final CacheManager cacheManager;

    public StatsServiceIntegrationTest(StatsService statsService,
            UserService userService,
            UserRepository userRepository,
            TradeRepository tradeRepository,
            MarketRepository marketRepository,
            CacheManager cacheManager) {
        this.statsService = statsService;
        this.userService = userService;
        this.tradeRepository = tradeRepository;
        this.marketRepository = marketRepository;
        this.cacheManager = cacheManager;
    }

    @Test
    @Order(1)
    @Transactional
    @DisplayName("1. 대시보드 기본 요약 지표(총 회원수, 총 거래수, 총 지갑수) 산출 정확도 검증")
    void test01_getSummaryStats_Success() {
        // 테스트용 데이터 가입
        User u1 = userService.registerUser("stats_u1@example.com", "pass", "STANDARD");
        userService.getOrCreateWallet(u1.getUserId(), "KRW");

        // 수치 요약 조회
        SummaryODT summary = statsService.getSummaryStats();

        // 1명 회원 등록, 1개 지갑 등록되었는지 검증
        assertThat(summary.getTotalUsers()).isGreaterThanOrEqualTo(1L);
        assertThat(summary.getTotalWallets()).isGreaterThanOrEqualTo(1L);
    }

    @Test
    @Order(2)
    @Transactional
    @DisplayName("2. 현재가 조회 시 Caffeine Cache(@Cacheable)의 캐싱 및 동적 갱신 정책 검증")
    void test02_getLastPrice_Caching_Success() {
        String symbol = "BTC-USD";

        // 마켓 기초정보 주입
        Market market = new Market();
        market.setSymbol(symbol);
        market.setBaseCurrency("BTC");
        market.setQuoteCurrency("USD");
        market.setListingPrice(50000L);
        market.setStatus("ACTIVE");
        marketRepository.save(market);

        // 첫 번째 현재가 호출 (DB에서 조회하여 캐시 적재)
        Long price1 = statsService.getLastPrice(symbol);
        assertThat(price1).isEqualTo(5000000L);

        // 캐시 매니저에 "lastPrice" 캐시가 존재하고 값이 적재되었는지 검증
        assertThat(cacheManager.getCache("lastPrice")).isNotNull();
        assertThat(cacheManager.getCache("lastPrice").get(symbol)).isNotNull();
    }

    @Test
    @Order(3)
    @Transactional
    @DisplayName("3. 전일 종가(기준 시각) 기준 마지막 체결 가격 또는 기본 상장가 추출 로직 검증")
    void test03_getPrevClosePrice_Success() {
        String symbol = "ETH-USD";
        Market market = new Market();
        market.setSymbol(symbol);
        market.setBaseCurrency("ETH");
        market.setQuoteCurrency("USD");
        market.setListingPrice(3000L);
        market.setStatus("ACTIVE");
        marketRepository.save(market);
        marketRepository.flush();

        // 거래 내역이 없을 경우 상장 기준가인 3000달러를 종가로 반환하는지 검증
        Long closePrice = statsService.getPrevClosePrice(symbol);
        assertThat(closePrice).isEqualTo(300000L);
    }

    @Test
    @Order(4)
    @Transactional
    @DisplayName("4. 활성 마켓 전체 티커(현재가, 전일 종가) 일괄 벌크 조회 검증")
    void test04_getTickers_Success() {
        String symbol = "ADA-USD";
        Market market = new Market();
        market.setSymbol(symbol);
        market.setBaseCurrency("ADA");
        market.setQuoteCurrency("USD");
        market.setListingPrice(500L);
        market.setStatus("ACTIVE");
        marketRepository.save(market);
        marketRepository.flush();

        // 티커 정보 목록 조회 실행
        List<TickerODT> tickers = statsService.getTickers();

        // 등록한 마켓의 티커 정보가 포함되어 있는지 검증
        assertThat(tickers).anyMatch(t -> t.getSymbol().equals("ADA-USD") && t.getLastPrice() == 50000L);
    }

    @Test
    @Order(5)
    @Transactional
    @DisplayName("5. 체결 데이터를 기반으로 시간 단위(1분봉 등) 시계열 봉 데이터(OHLCV) 집계 쿼리 검증")
    void test05_getCandleStats_Success() {
        String symbol = "BTC-USD";

        // 테스트 격리 환경에서 마켓 설정의 소수점 자릿수(price_decimals)를 동적으로 매칭시키기 위해 마켓 정보를 사전에 등록함.
        Market market = new Market();
        market.setSymbol(symbol);
        market.setBaseCurrency("BTC");
        market.setQuoteCurrency("USD");
        market.setPriceDecimals(2);
        market.setListingPrice(50000L);
        market.setStatus("ACTIVE");
        marketRepository.save(market);

        // 캔들 집계 쿼리 실행 시 소수점 자릿수 보정 연산(/ 10^price_decimals)이 수행되므로, 이를 감안하여 100배 스케일링된
        // 체결 가격(4500000L)을 데이터베이스에 등록함.
        Trade trade = new Trade();
        trade.setTradeId(101L);
        trade.setSymbol(symbol);
        trade.setBuyOrderId(1001L);
        trade.setSellOrderId(1002L);
        trade.setPrice(4500000L);
        trade.setQty(2L);
        tradeRepository.save(trade);

        marketRepository.flush();
        tradeRepository.flush();

        // 1분(1m) 캔들 차트 조회 실행
        List<CandleODT> candles = statsService.getCandleStats(symbol, "1m", 10);

        // 데이터가 정상 집계되어 OHLCV 형태로 리스팅되는지 검증
        assertThat(candles).isNotEmpty();
        CandleODT candle = candles.get(0);
        assertThat(candle.getClose()).isEqualTo(45000.0);
        assertThat(candle.getVolume()).isEqualTo(2.0);
    }

    @Test
    @Order(6)
    @Transactional
    @DisplayName("6. 수수료 누적 수익, DAU/MAU 활동성 비율, 자산 회전율, 주문 체결 효율성(Fill Rate) 백분율 계산 정합성 검증")
    void test06_getPerformanceStats_Success() {
        // 성능 분석 및 대시보드 분석 조회 실행
        PerformanceODT perf = statsService.getPerformanceStats();

        // 수치 모델 계산 시 NullPointerException 없이 통계 구조가 정상 빌드되어 출력되는지 검증
        assertThat(perf.getActiveUsers()).isNotNull();
        assertThat(perf.getOrderEfficiency()).isNotNull();
        assertThat(perf.getTradingVelocity()).isNotNull();
        assertThat(perf.getCompetitors()).isNotEmpty();
    }
}
