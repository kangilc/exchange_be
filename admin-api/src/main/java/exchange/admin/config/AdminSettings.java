package exchange.admin.config;

/**
 * 어드민 서비스 설정을 보관하는 인메모리 홀더 클래스.
 */
public class AdminSettings {
    private static volatile boolean duplicateLoginBlockEnabled = true;

    public static boolean isDuplicateLoginBlockEnabled() {
        return duplicateLoginBlockEnabled;
    }

    public static void setDuplicateLoginBlockEnabled(boolean enabled) {
        duplicateLoginBlockEnabled = enabled;
    }
}
