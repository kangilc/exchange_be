package exchange.admin.config;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 특정 서비스 메소드의 DB 등록자 및 수정자 식별자를 지정하는 어노테이션입니다.
 * AOP를 통해 스레드 안전하게 자동으로 ThreadLocal 영역에 등록되며 호출 완료 시 안전하게 클리어됩니다.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface SystemAuditor {
    /**
     * 등록될 시스템 식별자 명칭을 의미합니다. (예: "WalletDaemon", "BatchJob")
     * 최종 등록자/수정자는 "SYSTEM:{value}" 형식으로 기입됩니다.
     */
    String value();
}
