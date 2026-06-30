package exchange.admin.config;

import com.github.benmanes.caffeine.cache.Caffeine;

import org.jetbrains.annotations.NotNull;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Spring Cache Abstraction을 사용하여 모든 Caffeine 캐시 설정을 통합 관리하는 설정 클래스.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();

        // 1. 글로벌 마켓 수수료 캐시 설정 등록
        com.github.benmanes.caffeine.cache.Cache<Object, Object> marketFeeRatesCache = Caffeine.newBuilder()
                .maximumSize(50)
                .build();
        cacheManager.registerCustomCache("marketFeeRates", marketFeeRatesCache);

        // 2. 실시간 현재가 캐시 설정 등록 (1초 만료)
        com.github.benmanes.caffeine.cache.Cache<Object, Object> lastPriceCache = Caffeine.newBuilder()
                .expireAfterWrite(1, TimeUnit.SECONDS)
                .maximumSize(100)
                .build();
        cacheManager.registerCustomCache("lastPrice", lastPriceCache);

        return cacheManager;
    }
}
