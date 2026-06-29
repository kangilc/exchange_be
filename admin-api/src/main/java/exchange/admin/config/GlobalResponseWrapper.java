package exchange.admin.config;

import exchange.admin.dto.ApiResponse;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * 모든 REST API 컨트롤러의 응답을 가로채어 공통 규격인 ApiResponse로 감싸주는 래퍼 클래스입니다.
 */
@RestControllerAdvice(basePackages = "exchange.admin.controller")
public class GlobalResponseWrapper implements ResponseBodyAdvice<Object> {

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        // 이미 ApiResponse 형태로 명시적으로 반환하는 경우는 중복 래핑을 방지합니다.
        return !returnType.getParameterType().isAssignableFrom(ApiResponse.class);
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {

        int status = 200;
        if (response instanceof ServletServerHttpResponse) {
            status = ((ServletServerHttpResponse) response).getServletResponse().getStatus();
        }

        // 전역 예외 처리기 등에서 넘어온 응답이 Map 형태이면서 에러인 경우 (예방 차원)
        if (body instanceof java.util.Map && status >= 400 && ((java.util.Map<?, ?>) body).containsKey("message")) {
            String message = (String) ((java.util.Map<?, ?>) body).get("message");
            return ApiResponse.error(status, message);
        }

        // 이미 래핑된 경우 그대로 반환
        if (body instanceof ApiResponse) {
            return body;
        }

        return ApiResponse.success(status, body);
    }
}
