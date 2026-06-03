package exchange.admin.config;

/**
 * 어드민 서비스 설정을 보관하는 인메모리 홀더 클래스.
 */
public class AdminSettings {
    private static volatile boolean duplicateLoginBlockEnabled = true;
    private static volatile int btcConfirmations = 3;
    private static volatile int ethConfirmations = 12;
    private static volatile int adaConfirmations = 5;

    public static boolean isDuplicateLoginBlockEnabled() {
        return duplicateLoginBlockEnabled;
    }

    public static void setDuplicateLoginBlockEnabled(boolean enabled) {
        duplicateLoginBlockEnabled = enabled;
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
