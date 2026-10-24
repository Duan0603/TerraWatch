package vn.terrawatch.core.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.security.Key;
import java.util.Map;
import java.util.function.Function;

/**
 * Verifies a Firebase ID token (RS256, signed by Google) per
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens and accepts only Google sign-ins
 * with a verified email. The email is taken from the verified token, never from the request.
 */
@Component
public class FirebaseIdTokenVerifier {
    public record GoogleIdentity(String email, String name) {}

    private final String projectId;
    private final Function<String, ? extends Key> keyForKid;

    @Autowired
    public FirebaseIdTokenVerifier(@Value("${firebase.project-id}") String projectId) {
        this(projectId, new GoogleCertCache()::get);
    }

    FirebaseIdTokenVerifier(String projectId, Function<String, ? extends Key> keyForKid) {
        this.projectId = projectId;
        this.keyForKid = keyForKid;
    }

    public GoogleIdentity verify(String idToken) {
        Claims claims;
        try {
            claims = Jwts.parser()
                .keyLocator(new LocatorAdapter<Key>() {
                    @Override
                    protected Key locate(JwsHeader header) {
                        if (!"RS256".equals(header.getAlgorithm())) {
                            return null; // jjwt rejects the token when no key is returned
                        }
                        return keyForKid.apply(header.getKeyId());
                    }
                })
                .requireIssuer("https://securetoken.google.com/" + projectId)
                .requireAudience(projectId)
                .clockSkewSeconds(60)
                .build().parseSignedClaims(idToken).getPayload();
        } catch (ResponseStatusException unavailable) {
            throw unavailable; // key fetch failure surfaces as 503, not 401
        } catch (Exception invalid) {
            throw unauthorized();
        }

        String subject = claims.getSubject();
        String email = claims.get("email", String.class);
        Boolean emailVerified = claims.get("email_verified", Boolean.class);
        if (subject == null || subject.isBlank() || email == null || email.isBlank()
                || !Boolean.TRUE.equals(emailVerified) || !"google.com".equals(signInProvider(claims))) {
            throw unauthorized();
        }
        return new GoogleIdentity(email, claims.get("name", String.class));
    }

    private static String signInProvider(Claims claims) {
        Object firebase = claims.get("firebase");
        return firebase instanceof Map<?, ?> map && map.get("sign_in_provider") instanceof String provider
            ? provider : null;
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google sign-in");
    }
}
