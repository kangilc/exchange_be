package exchange.admin.config;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

/**
 * SystemAuditor 어노테이션이 붙은 메소드를 탐지하여
 * 스레드 세팅과 리소스 청소(ThreadLocal.remove())를 안전하게 보장해주는 AOP 클래스입니다.
 */
@Aspect
@Component
public class SystemAuditorAspect {

    @Around("@annotation(systemAuditor)")
    public Object setAuditor(ProceedingJoinPoint joinPoint, SystemAuditor systemAuditor) throws Throwable {
        try {
            // 메소드 진입 전 ThreadLocal에 지정한 시스템 명칭 저장
            AuditorContextHolder.setSystemAuditor("SYSTEM:" + systemAuditor.value());
            return joinPoint.proceed();
        } finally {
            // 작업 완료 후 (정상 종료 또는 에러 무관) ThreadLocal 메모리 반드시 제거하여 리크 방지
            AuditorContextHolder.clear();
        }
    }
}
