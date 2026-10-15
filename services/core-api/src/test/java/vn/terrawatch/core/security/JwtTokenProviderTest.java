package vn.terrawatch.core.security;

import org.junit.jupiter.api.Test;
import vn.terrawatch.core.entity.User;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class JwtTokenProviderTest {
    private static final String SECRET = "test-only-secret-at-least-thirty-two-bytes-long";
    private final JwtTokenProvider tokens = new JwtTokenProvider(SECRET, 60_000);

    @Test
    void roundTripsIdentityAndAllRoles() {
        for (String role : new String[]{"citizen", "officer", "admin"}) {
            User user = new User("Test", "test@example.com", "never-in-token", role, null);
            user.setUserId(UUID.randomUUID());
            String token = tokens.generateToken(user);
            var claims = tokens.validateAndParse(token);
            assertThat(claims.getSubject()).isEqualTo(user.getUserId().toString());
            assertThat(claims.get("email")).isEqualTo(user.getEmail());
            assertThat(claims.get("role")).isEqualTo(role);
            assertThat(claims.getExpiration().getTime() - claims.getIssuedAt().getTime()).isEqualTo(60_000);
            assertThat(claims).doesNotContainKeys("password", "passwordHash");
        }
    }

    @Test
    void rejectsExpiredTamperedMalformedAndWrongKeyTokens() {
        User user = new User("Test", "test@example.com", "hash", "citizen", null);
        user.setUserId(UUID.randomUUID());
        String valid = tokens.generateToken(user);
        assertThatThrownBy(() -> new JwtTokenProvider(SECRET, -60_000).validateAndParse(
            new JwtTokenProvider(SECRET, -60_000).generateToken(user))).isInstanceOf(RuntimeException.class);
        for (String invalid : new String[]{"garbage", "", valid.substring(0, valid.lastIndexOf('.') + 1) + "AAAA"}) {
            assertThatThrownBy(() -> tokens.validateAndParse(invalid)).isInstanceOf(RuntimeException.class);
        }
        assertThatThrownBy(() -> new JwtTokenProvider(SECRET + "other", 60_000).validateAndParse(valid))
            .isInstanceOf(RuntimeException.class);
    }
}
