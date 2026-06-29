package exchange.admin.exception;

/**
 * 인증 과정(로그인, 토큰 갱신 등)에서 발생하는 비즈니스 예외.
 */
public class AuthException extends RuntimeException {
    public AuthException(String message) {
        super(message);
    }
}
