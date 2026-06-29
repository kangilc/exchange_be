package exchange.admin.exception;

import exchange.admin.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 컨트롤러 전역에서 발생하는 예외를 한 곳에서 처리하여 규격화된 오류 응답을 전달하는 예외 처리 클래스입니다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * DTO 유효성 검증 실패(Jakarta Validation API 에러) 시 발생하는 MethodArgumentNotValidException을 가로채어
     * 에러 필드 중 첫 번째 에러 메시지를 ApiResponse 구조로 감싸 400 Bad Request와 함께 반환합니다.
     * 
     * @param ex 유효성 검증 실패 예외
     * @return 에러 메시지를 담은 응답 객체
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        String errorMessage = ex.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        return ResponseEntity.badRequest().body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), errorMessage));
    }

    /**
     * 인증 과정에서 발생하는 비즈니스 예외를 401 Unauthorized로 반환함.
     * 
     * @param ex 인증 관련 예외
     * @return 에러 메시지를 담은 응답 객체
     */
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthExceptions(AuthException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(HttpStatus.UNAUTHORIZED.value(), ex.getMessage()));
    }
}
