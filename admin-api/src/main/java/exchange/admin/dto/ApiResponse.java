package exchange.admin.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * API 공통 응답 래퍼 클래스.
 * 
 * @param <T> 응답 데이터 타입
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    /** API 처리 성공 여부 */
    private boolean success;

    /** HTTP 상태 코드 */
    private int status;

    /** 처리 결과 메시지 */
    private String message;

    /** 응답 데이터 */
    private T data;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonProperty("http.method")
    private String method;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonProperty("http.path")
    private String path;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonProperty("latency_ms")
    private Long latencyMs;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonProperty("client_ip")
    private String clientIp;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    @JsonProperty("user_agent")
    private String userAgent;

    /**
     * 성공 응답 생성 (상태 코드 명시).
     * 
     * @param status HTTP 상태 코드
     * @param data   응답 데이터
     * @param <T>    데이터 타입
     * @return ApiResponse 객체
     */
    public static <T> ApiResponse<T> success(int status, T data) {
        return ApiResponse.<T>builder()
                .success(true) // 성공 응답 마킹함
                .status(status)
                .message("Success")
                .data(data)
                .build();
    }

    /**
     * 성공 응답 생성 (기본 200 OK).
     * 
     * @param data 응답 데이터
     * @param <T>  데이터 타입
     * @return ApiResponse 객체
     */
    public static <T> ApiResponse<T> success(T data) {
        return success(200, data);
    }

    /**
     * 메세지만 포함하는 성공 응답 생성 (기본 200 OK).
     * 
     * @param message 성공 메시지
     * @param <T>     데이터 타입
     * @return ApiResponse 객체
     */
    public static <T> ApiResponse<T> successWithoutData(String message) {
        return ApiResponse.<T>builder()
                .success(true) // 성공 응답 마킹함
                .status(200)
                .message(message)
                .data(null)
                .build();
    }

    /**
     * 200 OK 응답 생성.
     * 
     * @param data 응답 데이터
     * @param <T>  데이터 타입
     * @return ResponseEntity 객체
     */
    public static <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(success(data));
    }

    /**
     * 500 Internal Server Error 응답 생성.
     * 
     * @param message 에러 메시지
     * @param <T>     데이터 타입
     * @return ResponseEntity 객체
     */
    public static <T> ResponseEntity<ApiResponse<T>> internalServerError(String message) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error(HttpStatus.INTERNAL_SERVER_ERROR.value(), message));
    }

    /**
     * 401 Unauthorized 응답 생성.
     * 
     * @param message 에러 메시지
     * @param <T>     데이터 타입
     * @return ResponseEntity 객체
     */
    public static <T> ResponseEntity<ApiResponse<T>> unauthorized(String message) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error(HttpStatus.UNAUTHORIZED.value(), message));
    }

    /**
     * 페이로드 없는 200 OK 응답 생성.
     * 
     * @param message 성공 메시지
     * @param <T>     데이터 타입
     * @return ResponseEntity 객체
     */
    public static <T> ResponseEntity<ApiResponse<T>> ok(String message) {
        return ResponseEntity.ok(successWithoutData(message));
    }

    /**
     * 400 Bad Request 응답 생성.
     * 
     * @param message 에러 메시지
     * @param <T> 데이터 타입
     * @return ResponseEntity 객체
     */
    public static <T> ResponseEntity<ApiResponse<T>> badRequest(String message) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error(HttpStatus.BAD_REQUEST.value(), message));
    }

    /**
     * 404 Not Found 응답 생성.
     * 
     * @param message 에러 메시지
     * @param <T> 데이터 타입
     * @return ResponseEntity 객체
     */
    public static <T> ResponseEntity<ApiResponse<T>> notFound(String message) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error(HttpStatus.NOT_FOUND.value(), message));
    }

    /**
     * 에러 응답 생성.
     * 
     * @param status  HTTP 상태 코드
     * @param message 에러 메시지
     * @param <T>     데이터 타입
     * @return ApiResponse 객체
     */
    public static <T> ApiResponse<T> error(int status, String message) {
        ApiResponse<T> response = ApiResponse.<T>builder()
                .success(false) // 실패 응답 마킹함
                .status(status)
                .message(message)
                .data(null)
                .build();

        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                response.setMethod(request.getMethod());
                response.setPath(request.getRequestURI());
                response.setUserAgent(request.getHeader("User-Agent"));

                String ip = request.getHeader("X-Forwarded-For");
                if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
                    ip = request.getHeader("X-Real-IP");
                }
                if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
                    ip = request.getRemoteAddr();
                }
                response.setClientIp(ip);

                Long startTime = (Long) request.getAttribute("startTime");
                if (startTime != null) {
                    response.setLatencyMs(System.currentTimeMillis() - startTime);
                }
            }
        } catch (Exception e) {
            // 메타데이터 수집 실패 시 무시
        }

        return response;
    }
}
