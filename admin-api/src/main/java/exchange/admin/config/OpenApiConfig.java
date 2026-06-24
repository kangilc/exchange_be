package exchange.admin.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger/OpenAPI 명세 출력을 설정하는 Spring 설정 클래스입니다.
 * 어드민 API 문서의 타이틀, 버전 및 설명정보를 구성하며,
 * 모든 API 요청에서 JWT Bearer 인증을 테스트할 수 있도록 Security Scheme을 추가합니다.
 */
@Configuration
public class OpenApiConfig {

    /**
     * OpenAPI 설정을 커스터마이징하여 반환합니다.
     * Bearer 인증 요구사항 및 JWT 스키마 정의가 포함됩니다.
     * 
     * @return 설정이 구성된 OpenAPI 객체
     */
    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("JavaF Exchange Admin API")
                        .version("1.0.0")
                        .description("JavaF Exchange integrated management Admin API specification with JWT security."))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }
}
