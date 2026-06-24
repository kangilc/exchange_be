package exchange.admin.config;

/**
 * 어드민 서비스 설정을 보관하는 인메모리 홀더 클래스.
 * 중복 로그인 제한, 온체인 입금 모니터링 활성화 여부, 코인별 입금 컨펌 수 설정, 지갑 시뮬레이션 상태 등을
 * 전역 static 변수로 관리하며, Spring Cache(marketFeeRates)를 활용해 마켓별 수수료율 정보를 인메모리에 캐싱 및 제공합니다.
 */
public class AdminSettings {
    /** 중복 로그인 차단 활성화 여부 */
    private static volatile boolean duplicateLoginBlockEnabled = true;
    /** 실시간 온체인 입금 모니터링 및 컨펌 가산 처리 활성화 여부 */
    private static volatile boolean onChainDepositMonitoringEnabled = true;
    /** BTC(비트코인) 입금 인정을 위한 최소 블록 컨펌 수 */
    private static volatile int btcConfirmations = 3;
    /** ETH(이더리움) 입금 인정을 위한 최소 블록 컨펌 수 */
    private static volatile int ethConfirmations = 12;
    /** ADA(에이다) 입금 인정을 위한 최소 블록 컨펌 수 */
    private static volatile int adaConfirmations = 5;
    /** 지갑 입출금 시뮬레이션(가상 테스트 환경) 활성화 여부 */
    private static volatile boolean walletSimulationEnabled = true;
    /** 마켓별 수수료율 인메모리 캐시 관리를 위한 CacheManager 참조 */
    @org.springframework.beans.factory.annotation.Autowired
    private static org.springframework.cache.CacheManager cacheManager;

    /**
     * static 영역의 cacheManager 빈 주입을 위해 선언한 헬퍼 컴포넌트 빈.
     */
    @org.springframework.stereotype.Component
    public static class CacheManagerHolder {
        public CacheManagerHolder(org.springframework.cache.CacheManager cacheManager) {
            AdminSettings.cacheManager = cacheManager;
        }
    }

    /**
     * marketFeeRates 캐시 영역을 획득하는 내부 static 메서드.
     * @return Cache 인스턴스 또는 null
     */
    private static org.springframework.cache.Cache getCache() {
        return cacheManager != null ? cacheManager.getCache("marketFeeRates") : null;
    }

    /**
     * 특정 종목(symbol)의 수수료율을 조회합니다. 캐시에 없을 경우 기본값(0.001 = 0.1%)을 반환합니다.
     * @param symbol 종목 심볼 (예: BTC-USD)
     * @return 수수료율 (double)
     */
    public static double getFeeRate(String symbol) {
        org.springframework.cache.Cache cache = getCache();
        if (cache != null) {
            Double fee = cache.get(symbol, Double.class);
            if (fee != null) return fee;
        }
        return 0.001000;
    }

    /**
     * 특정 종목(symbol)의 수수료율을 캐시에 저장하거나 업데이트합니다.
     * @param symbol 종목 심볼 (예: BTC-USD)
     * @param feeRate 설정할 수수료율
     */
    public static void setFeeRate(String symbol, double feeRate) {
        org.springframework.cache.Cache cache = getCache();
        if (cache != null) {
            cache.put(symbol, feeRate);
        }
    }

    /**
     * 현재 캐싱된 모든 마켓의 수수료율을 Map 형태로 일괄 반환합니다.
     * @return 마켓 심볼과 수수료율 맵
     */
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

    /**
     * 지갑 시뮬레이션 모드 활성화 여부를 조회합니다.
     * @return 시뮬레이션 활성화 여부
     */
    public static boolean isWalletSimulationEnabled() {
        return walletSimulationEnabled;
    }

    /**
     * 지갑 시뮬레이션 모드 활성화 여부를 설정합니다.
     * @param enabled 활성화 여부
     */
    public static void setWalletSimulationEnabled(boolean enabled) {
        walletSimulationEnabled = enabled;
    }

    /**
     * 동일 계정의 중복 로그인 차단 활성화 여부를 조회합니다.
     * @return 중복 로그인 차단 활성화 여부
     */
    public static boolean isDuplicateLoginBlockEnabled() {
        return duplicateLoginBlockEnabled;
    }

    /**
     * 동일 계정의 중복 로그인 차단 활성화 여부를 설정합니다.
     * @param enabled 활성화 여부
     */
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

    /**
     * BTC 입금에 필요한 컨펌 수를 가져옵니다.
     * @return BTC 컨펌 수
     */
    public static int getBtcConfirmations() {
        return btcConfirmations;
    }

    /**
     * BTC 입금에 필요한 컨펌 수를 설정합니다.
     * @param confirmations 설정할 컨펌 수
     */
    public static void setBtcConfirmations(int confirmations) {
        btcConfirmations = confirmations;
    }

    /**
     * ETH 입금에 필요한 컨펌 수를 가져옵니다.
     * @return ETH 컨펌 수
     */
    public static int getEthConfirmations() {
        return ethConfirmations;
    }

    /**
     * ETH 입금에 필요한 컨펌 수를 설정합니다.
     * @param confirmations 설정할 컨펌 수
     */
    public static void setEthConfirmations(int confirmations) {
        ethConfirmations = confirmations;
    }

    /**
     * ADA 입금에 필요한 컨펌 수를 가져옵니다.
     * @return ADA 컨펌 수
     */
    public static int getAdaConfirmations() {
        return adaConfirmations;
    }

    /**
     * ADA 입금에 필요한 컨펌 수를 설정합니다.
     * @param confirmations 설정할 컨펌 수
     */
    public static void setAdaConfirmations(int confirmations) {
        adaConfirmations = confirmations;
    }
}
