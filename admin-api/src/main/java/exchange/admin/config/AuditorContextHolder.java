package exchange.admin.config;

public class AuditorContextHolder {
    private static final ThreadLocal<String> CONTEXT = new ThreadLocal<>();

    /**
     * 현재 스레드에 시스템 등록자 식별자를 설정합니다.
     * @param systemName 시스템 명칭 (예: SYSTEM:WalletDaemon)
     */
    public static void setSystemAuditor(String systemName) {
        CONTEXT.set(systemName);
    }

    /**
     * 현재 스레드에 설정된 시스템 등록자 식별자를 반환합니다.
     */
    public static String getSystemAuditor() {
        return CONTEXT.get();
    }

    /**
     * ThreadLocal 자원을 해제하여 스레드 풀 환경에서의 메모리 누수 및 오염을 방지합니다.
     */
    public static void clear() {
        CONTEXT.remove();
    }
}
