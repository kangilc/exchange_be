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

@Component
public class JwtTokenProvider {

    private static final Logger logger = Logger.getLogger(JwtTokenProvider.class.getName());

    private final SecretKey jwtSecretKey;
    
    // Access Token: 1시간
    private final long accessTokenExpirationMs = 3600000L;
    // Refresh Token: 7일
    private final long refreshTokenExpirationMs = 7 * 24 * 3600000L;

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

    public String generateAccessToken(String email, String role, String refreshToken) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + accessTokenExpirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .claim("refreshToken", refreshToken)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(jwtSecretKey, Jwts.SIG.HS256)
                .compact();
    }

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

    public String generateRefreshToken(String email) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + refreshTokenExpirationMs);

        return Jwts.builder()
                .subject(email)
                .claim("type", "refresh")
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(jwtSecretKey, Jwts.SIG.HS256)
                .compact();
    }

    public String getEmailFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(jwtSecretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.getSubject();
    }

    public String getRoleFromToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(jwtSecretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return claims.get("role", String.class);
    }

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
