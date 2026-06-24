package exchange.admin.config;

/**
 * JPA Auditing에서 현재 요청을 수행하는 주체(Auditor) 식별자를 ThreadLocal을 통해 관리하는 홀더 클래스입니다.
 * 주로 백그라운드 배치 작업이나 데몬 등 인증 컨텍스트(SecurityContext)가 존재하지 않는 스레드 환경에서
 * 시스템 식별자(예: SYSTEM:WalletDaemon)를 등록하여 생성자/수정자 지정을 지원합니다.
 */
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
