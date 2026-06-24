package exchange.admin.config;

/**
 * 어드민 서비스 설정을 보관하는 인메모리 홀더 클래스.
 */
public class AdminSettings {
    private static volatile boolean duplicateLoginBlockEnabled = true;
    /** 실시간 온체인 입금 모니터링 및 컨펌 가산 처리 활성화 여부 */
    private static volatile boolean onChainDepositMonitoringEnabled = true;
    private static volatile int btcConfirmations = 3;
    private static volatile int ethConfirmations = 12;
    private static volatile int adaConfirmations = 5;
    private static volatile boolean walletSimulationEnabled = true;
    @org.springframework.beans.factory.annotation.Autowired
    private static org.springframework.cache.CacheManager cacheManager;

    @org.springframework.stereotype.Component
    public static class CacheManagerHolder {
        public CacheManagerHolder(org.springframework.cache.CacheManager cacheManager) {
            AdminSettings.cacheManager = cacheManager;
        }
    }

    private static org.springframework.cache.Cache getCache() {
        return cacheManager != null ? cacheManager.getCache("marketFeeRates") : null;
    }

    public static double getFeeRate(String symbol) {
        org.springframework.cache.Cache cache = getCache();
        if (cache != null) {
            Double fee = cache.get(symbol, Double.class);
            if (fee != null) return fee;
        }
        return 0.001000;
    }

    public static void setFeeRate(String symbol, double feeRate) {
        org.springframework.cache.Cache cache = getCache();
        if (cache != null) {
            cache.put(symbol, feeRate);
        }
    }

    @SuppressWarnings("unchecked")
    public static java.util.Map<String, Double> getMarketFeeRates() {
        org.springframework.cache.Cache cache = getCache();
        if (cache != null && cache.getNativeCache() != null) {
            Object nativeCache = cache.getNativeCache();
            try {
                java.lang.reflect.Method asMapMethod = nativeCache.getClass().getMethod("asMap");
                return (java.util.Map<String, Double>) asMapMethod.invoke(nativeCache);
            } catch (Exception e) {
                // Reflection fallback
            }
        }
        return java.util.Collections.emptyMap();
    }


    public static boolean isWalletSimulationEnabled() {
        return walletSimulationEnabled;
    }

    public static void setWalletSimulationEnabled(boolean enabled) {
        walletSimulationEnabled = enabled;
    }

    public static boolean isDuplicateLoginBlockEnabled() {
        return duplicateLoginBlockEnabled;
    }

    public static void setDuplicateLoginBlockEnabled(boolean enabled) {
        duplicateLoginBlockEnabled = enabled;
    }

    /**
     * @return 실시간 온체인 입금 모니터링이 활성화되어 있는지 여부를 반환합니다.
     */
    public static boolean isOnChainDepositMonitoringEnabled() {
        return onChainDepositMonitoringEnabled;
    }

    /**
     * 실시간 온체인 입금 모니터링의 활성화 상태를 업데이트합니다.
     * @param enabled 활성화 여부
     */
    public static void setOnChainDepositMonitoringEnabled(boolean enabled) {
        onChainDepositMonitoringEnabled = enabled;
    }

    public static int getBtcConfirmations() {
        return btcConfirmations;
    }

    public static void setBtcConfirmations(int confirmations) {
        btcConfirmations = confirmations;
    }

    public static int getEthConfirmations() {
        return ethConfirmations;
    }

    public static void setEthConfirmations(int confirmations) {
        ethConfirmations = confirmations;
    }

    public static int getAdaConfirmations() {
        return adaConfirmations;
    }

    public static void setAdaConfirmations(int confirmations) {
        adaConfirmations = confirmations;
    }
}
