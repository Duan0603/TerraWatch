package vn.terrawatch.core.security;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FirebaseIdTokenVerifierTest {
    private static final String PROJECT = "terrawatch-ac26f";
    private final KeyPair signer = newKeyPair();
    private final KeyPair attacker = newKeyPair();
    private final FirebaseIdTokenVerifier verifier = new FirebaseIdTokenVerifier(PROJECT,
        (Function<String, java.security.Key>) kid -> "kid-1".equals(kid) ? signer.getPublic() : null);

    private static KeyPair newKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private io.jsonwebtoken.JwtBuilder token(String issuer, String audience, boolean verified, String provider, Instant exp) {
        return Jwts.builder().header().keyId("kid-1").and()
            .issuer(issuer).audience().add(audience).and().subject("firebase-uid-1")
            .claim("email", "Citizen@Example.com").claim("email_verified", verified).claim("name", "Nguyen Van A")
            .claim("firebase", Map.of("sign_in_provider", provider))
            .issuedAt(Date.from(Instant.now().minusSeconds(30))).expiration(Date.from(exp));
    }

    private String valid() {
        return token("https://securetoken.google.com/" + PROJECT, PROJECT, true, "google.com",
            Instant.now().plusSeconds(3600)).signWith(signer.getPrivate()).compact();
    }

    @Test
    void acceptsValidGoogleTokenAndReturnsVerifiedEmail() {
        var identity = verifier.verify(valid());
        assertThat(identity.email()).isEqualTo("Citizen@Example.com");
        assertThat(identity.name()).isEqualTo("Nguyen Van A");
    }

    @Test
    void rejectsWrongAudienceIssuerExpiredUnverifiedEmailAndOtherProviders() {
        String iss = "https://securetoken.google.com/" + PROJECT;
        Instant later = Instant.now().plusSeconds(3600);
        var key = signer.getPrivate();
        assertUnauthorized(token(iss, "other-project", true, "google.com", later).signWith(key).compact());
        assertUnauthorized(token("https://securetoken.google.com/other", PROJECT, true, "google.com", later).signWith(key).compact());
        assertUnauthorized(token(iss, PROJECT, true, "google.com", Instant.now().minusSeconds(600)).signWith(key).compact());
        assertUnauthorized(token(iss, PROJECT, false, "google.com", later).signWith(key).compact());
        assertUnauthorized(token(iss, PROJECT, true, "phone", later).signWith(key).compact());
    }

    @Test
    void rejectsForgedSignatureUnknownKidTamperingAndUnsignedTokens() {
        String iss = "https://securetoken.google.com/" + PROJECT;
        Instant later = Instant.now().plusSeconds(3600);
        assertUnauthorized(token(iss, PROJECT, true, "google.com", later).signWith(attacker.getPrivate()).compact());
        assertUnauthorized(Jwts.builder().header().keyId("unknown").and().subject("x")
            .signWith(signer.getPrivate()).compact());
        String[] parts = valid().split("\\.");
        assertUnauthorized(parts[0] + "." + parts[1] + "x." + parts[2]);
        assertUnauthorized(token(iss, PROJECT, true, "google.com", later).compact());
        assertUnauthorized("not-a-jwt");
    }

    @Test
    void keyFetchFailureIsServiceUnavailableNotUnauthorized() {
        var failing = new FirebaseIdTokenVerifier(PROJECT, kid -> {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "down");
        });
        assertThatThrownBy(() -> failing.verify(valid()))
            .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(503));
    }

    private void assertUnauthorized(String idToken) {
        assertThatThrownBy(() -> verifier.verify(idToken))
            .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(401));
    }
}
