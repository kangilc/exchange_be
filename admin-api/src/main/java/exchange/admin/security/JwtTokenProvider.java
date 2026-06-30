package exchange.admin.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Date;
import java.util.List;
import java.util.logging.Logger;

/**
 * JWT(JSON Web Token)를 생성하고 유효성을 검증하며, 토큰 내의 각종 클레임(Claim) 정보를 파싱하는 공급자 클래스입니다.
 * application.properties의 `app.jwt.secret` 키를 기반으로 서명하며, 보안 키 미제공 시 실시간 임시 키를 자동 발급합니다.
 * Access Token(1시간) 및 Refresh Token(7일) 정책이 구현되어 있습니다.
 */
@Component
public class JwtTokenProvider {

    private static final Logger logger = Logger.getLogger(JwtTokenProvider.class.getName());

    private final SecretKey jwtSecretKey;
    
    // Access Token: 1시간
    private final long accessTokenExpirationMs = 3600000L;
    // Refresh Token: 7일
    private final long refreshTokenExpirationMs = 7 * 24 * 3600000L;

    /**
     * JwtTokenProvider 생성자. 설정 파일로부터 시크릿 키를 로드하며, 부적합할 시 경고 출력 후 임시 키를 적용합니다.
     * 
     * @param secret 설정 파일 내 주입된 시크릿 키 문자열
     */
    public JwtTokenProvider(@Value("${app.jwt.secret:}") String secret) {
        if (secret == null || secret.trim().isEmpty() || secret.length() < 32) {
            logger.warning("WARN(Security): JWT 시크릿 키가 누락되었거나 너무 짧습니다(최소 32자 필요). 동적 임시 보안키를 생성합니다. 인스턴스 간 수평 확장을 위해서 시크릿 키 설정이 필수적입니다.");
            // Generate dynamic key
            byte[] ephemeralKey = new byte[32];
            new SecureRandom().nextBytes(ephemeralKey);
            this.jwtSecretKey = Keys.hmacShaKeyFor(ephemeralKey);
        } else {
            this.jwtSecretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        }
    }

    /**
     * 사용자 식별 정보 및 등급, 리프레시 토큰 식별 클레임을 포함하는 Access Token을 발급합니다.
     * 
     * @param userId 회원 일련번호
     * @param email 회원 이메일
     * @param role 회원 보안 등급 (ADMIN, USER 등)
     * @param refreshToken 연계된 리프레시 토큰 문자열
     * @return 생성된 JWT Access Token
     */
    public String generateAccessToken(Long userId, String email, String role, String refreshToken) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + accessTokenExpirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("userId", userId)
                .claim("role", role)
                .claim("refreshToken", refreshToken)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(jwtSecretKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 토큰(일반적으로 Access Token) 내부에서 연계된 Refresh Token 문자열을 추출합니다.
     * 
     * @param token JWT 토큰
     * @return 클레임에 담겨 있던 refreshToken 값 또는 파싱 실패 시 null
     */
    public String getRefreshTokenFromToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(jwtSecretKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.get("refreshToken", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 세션 연장을 위한 1회성 Refresh Token을 발급합니다.
     * 
     * @param email 사용자 이메일
     * @return 생성된 JWT Refresh Token
     */
    public String generateRefreshToken(String email) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshTokenExpirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("type", "refresh")
                .claim("uuid", java.util.UUID.randomUUID().toString()) // 동일한 시간대(초 단위)에 토큰이 재생성될 때 토큰 문자열이 중복 발급되는 현상을 방어하기 위해 고유 UUID를 추가 클레임으로 주입함.
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(jwtSecretKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 토큰 서명 정보를 검증하여 사용자 이메일(Subject)을 반환합니다.
     * 
     * @param token JWT 토큰
     * @return 사용자 이메일
     */
    public String getEmailFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(jwtSecretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.getSubject();
    }

    /**
     * 토큰 서명 정보를 검증하여 권한(Role) 정보를 추출합니다.
     * 
     * @param token JWT 토큰
     * @return 권한명 (예: ADMIN, USER)
     */
    public String getRoleFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(jwtSecretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.get("role", String.class);
    }

    /**
     * 서명 및 만료 일시 등을 기준으로 토큰의 구조적 유효성을 최종 검증합니다.
     * 
     * @param token 검증 대상 JWT 토큰
     * @return 유효성 여부 (true/false)
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(jwtSecretKey)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            logger.warning("Invalid JWT signature/token: " + e.getMessage());
        }
        return false;
    }
}
