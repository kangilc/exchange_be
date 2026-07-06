package exchange.ws;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 🧪 MarketConfigManager의 가격대별 호가 단위(Tick Size) 정책 계산 단위 테스트.
 * 한국어 평어로 간결하게 주석을 작성함.
 */
class MarketConfigManagerTest {

    private MarketConfigManager manager;
    private ConcurrentHashMap<String, List<MarketConfigManager.TickSizeLevel>> tickSizeLevelsCache;
    private ConcurrentHashMap<String, Integer> decimalsCache;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() throws Exception {
        manager = MarketConfigManager.getInstance();

        // 테스트 격리를 위해 리플렉션으로 프라이빗 캐시 맵 획득 및 초기화
        Field levelsField = MarketConfigManager.class.getDeclaredField("tickSizeLevelsCache");
        levelsField.setAccessible(true);
        tickSizeLevelsCache = (ConcurrentHashMap<String, List<MarketConfigManager.TickSizeLevel>>) levelsField.get(manager);
        tickSizeLevelsCache.clear();

        Field decimalsField = MarketConfigManager.class.getDeclaredField("decimalsCache");
        decimalsField.setAccessible(true);
        decimalsCache = (ConcurrentHashMap<String, Integer>) decimalsField.get(manager);
        decimalsCache.clear();
    }

    @Test
    @DisplayName("캐시가 비어있을 때 소수점 자릿수(Decimals) 기반의 폴백 호가 단위를 검증한다")
    void testGetTickSize_Fallback() {
        // BTC-USD decimals = 8 -> 10^-8 = 0.00000001
        decimalsCache.put("BTC-USD", 8);
        BigDecimal tickSize = manager.getTickSize("BTC-USD", BigDecimal.valueOf(65000));
        assertThat(tickSize).isEqualByComparingTo("0.00000001");

        // ADA-KRW decimals = 4 -> 10^-4 = 0.0001
        decimalsCache.put("ADA-KRW", 4);
        BigDecimal tickSizeAda = manager.getTickSize("ADA-KRW", BigDecimal.valueOf(500));
        assertThat(tickSizeAda).isEqualByComparingTo("0.0001");
    }

    @Test
    @DisplayName("입력된 가격이 호가 단위 정책 구간에 따라 적합한 틱 사이즈를 리턴하는지 검증한다 (USD 표준 정책)")
    void testGetTickSize_WithRules() {
        // USD_STANDARD 정책 설정 주입
        // 0.0 이상 -> 0.0001
        // 1.0 이상 -> 0.01
        // 100.0 이상 -> 0.1
        // 1000.0 이상 -> 1.0
        List<MarketConfigManager.TickSizeLevel> levels = new ArrayList<>();
        levels.add(new MarketConfigManager.TickSizeLevel(BigDecimal.valueOf(0.0), BigDecimal.valueOf(0.0001)));
        levels.add(new MarketConfigManager.TickSizeLevel(BigDecimal.valueOf(1.0), BigDecimal.valueOf(0.01)));
        levels.add(new MarketConfigManager.TickSizeLevel(BigDecimal.valueOf(100.0), BigDecimal.valueOf(0.1)));
        levels.add(new MarketConfigManager.TickSizeLevel(BigDecimal.valueOf(1000.0), BigDecimal.valueOf(1.0)));
        tickSizeLevelsCache.put("JAF-USD", levels);

        // 1. humanPrice = 0.5 (1달러 미만 대역) -> 0.0001
        BigDecimal t1 = manager.getTickSize("JAF-USD", BigDecimal.valueOf(0.5));
        assertThat(t1).isEqualByComparingTo("0.0001");

        // 2. humanPrice = 50.0 (1달러 ~ 100달러 대역) -> 0.01
        BigDecimal t2 = manager.getTickSize("JAF-USD", BigDecimal.valueOf(50.0));
        assertThat(t2).isEqualByComparingTo("0.01");

        // 3. humanPrice = 500.0 (100달러 ~ 1000달러 대역) -> 0.1
        BigDecimal t3 = manager.getTickSize("JAF-USD", BigDecimal.valueOf(500.0));
        assertThat(t3).isEqualByComparingTo("0.1");

        // 4. humanPrice = 65000.0 (1000달러 이상 대역) -> 1.0
        BigDecimal t4 = manager.getTickSize("JAF-USD", BigDecimal.valueOf(65000.0));
        assertThat(t4).isEqualByComparingTo("1.0");
    }
}
