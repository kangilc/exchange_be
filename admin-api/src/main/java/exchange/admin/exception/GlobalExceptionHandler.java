package exchange.admin.exception;

import java.util.Map;

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
     * 에러 필드 중 첫 번째 에러 메시지를 Map 구조로 감싸 400 Bad Request와 함께 반환합니다.
     * 
     * @param ex 유효성 검증 실패 예외
     * @return 에러 메시지를 담은 응답 객체
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidationExceptions(MethodArgumentNotValidException ex) {
        // 첫 번째 에러 메시지를 가져와 응답으로 반환
        String errorMessage = ex.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        return ResponseEntity.badRequest().body(Map.of("message", errorMessage));
    }

    /**
     * 인증 과정에서 발생하는 비즈니스 예외를 401 Unauthorized로 반환함.
     * 
     * @param ex 인증 관련 예외
     * @return 에러 메시지를 담은 응답 객체
     */
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<?> handleAuthExceptions(AuthException ex) {
        return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", ex.getMessage()));
    }
}
