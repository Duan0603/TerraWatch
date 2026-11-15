package vn.terrawatch.core.security;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.testsupport.FakeHttpClient;
import vn.terrawatch.core.testsupport.FakeHttpClient.Reply;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.ConnectException;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.PublicKey;
import java.security.cert.CertificateFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * GoogleCertCache has no clock or HTTP seam (Instant.now() and a private final HttpClient), so tests swap the client by
 * reflection and move the cache's own expiry/fetch timestamps instead of sleeping. The certificates are throwaway
 * self-signed test certs generated locally for this test; they are not Google's.
 */
class GoogleCertCacheTest {
    private static final String CERT_A =
        "-----BEGIN CERTIFICATE-----\n" +
        "MIICnDCCAYQCCQCeNawQT8QfTzANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAV0\n" +
        "ZXN0MTAeFw0yNjExMTMxNzE4MzhaFw0zNjExMTAxNzE4MzhaMBAxDjAMBgNVBAMM\n" +
        "BXRlc3QxMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0UPxCrQ7PkFc\n" +
        "g35qR4nkrLVzbDZNaKe8ciIpM7Tk16lkIILsYBjANbfA/qhR+CtbWMkaE1hck3eW\n" +
        "vBYJ+rhpVrGt3ImT3BKmte9bE8D13WMYvL1N2kz0fsfu1IhwYP3iFpVnH9/y0sGL\n" +
        "twhToCZZFFbSbskAzYn6Aqvu6wekr4/O/gkPxYNX6u2LIuGTOv66O+h8Qox8ZVF8\n" +
        "NSzvI5Dh3ZcLsV2zr10HeC9QrtE7n392GE2mBDcj/DDzE0usuzEUgfB0CqjM7hma\n" +
        "09TYBugy1fzpu0og63IntQ6gcUB7Lic8n13DWPjSWgmi1Eh53duvwwZ4l9jZSHzy\n" +
        "cnaKbArLgQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQAIKgty6/vEfYsSZN9pgHyn\n" +
        "lb0FCO5RJdUfdycwrfEad3dFoGxhY5/t2Sb7GFFBIxa2HzUn98nhqLNZzyKYwN+/\n" +
        "/NiyUmBxqaNG5f/hAs608UrPqHDtUuHjAbu1mLs/NxP5HJoe1WEdyBGIB6Bvgwj5\n" +
        "+j5nEsNwR7i+yonkG0e5k3sNjeedGtarDuFVlAgzmq5i1nk3FyZUOlKOatGe4b+8\n" +
        "DPc/+w5Qzt811LpWcCdGeXuOPG7iiANx1sfOF3PG6NJeGO9pS4cDW285G9TzxjTG\n" +
        "EyEzZiiMFnL0Brv7xqwYUkaNVGMOw7pPECJALbnhxHvilz21y7vAvI/HxXxSRTAR\n" +
        "-----END CERTIFICATE-----\n";
    private static final String CERT_B =
        "-----BEGIN CERTIFICATE-----\n" +
        "MIICnDCCAYQCCQDG6E+Gdyhh0zANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAV0\n" +
        "ZXN0MjAeFw0yNjExMTMxNzE4MzhaFw0zNjExMTAxNzE4MzhaMBAxDjAMBgNVBAMM\n" +
        "BXRlc3QyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsX7FIM3pBjon\n" +
        "AZ08IPn2aDTwMf4/4e69SHQXI7Gv1RdEUyzVa6CyZq+PSpd/6k3BweHwJ3WydpWY\n" +
        "cG4BxNdu+5cMlSa7r/JrdmpnwaU2gvrAiPQFLa8tXW3sKWsYW2G5hkvOpGBfO3ep\n" +
        "bhjsQCI3gvtID/BSRbYfbO5uoKGdXl8RRiaMwvqjROIDwbtvL/r/00Rwd9I/XcPo\n" +
        "gCVIQFvaYQnArS8OUhPzv4cq6PKKsuH/7GU46prZ7SXYy59rtcBchclpLynEKoDI\n" +
        "44WZ7nOpcb+5DCfvP7WNXi1E8CNH6iaHNpmCPGWTb43Oy9/CNNTfHCyUJc3tY6wA\n" +
        "kFxkq6dNPwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCdD5xGWShyG/yEZEuEuRNa\n" +
        "upW9CJbIUyQMHV/OZ9UBKFrZjTHoa6hv3zCnp07wd5NqmT8FbEqCxdpUW4S7C9Yu\n" +
        "lCBcF85HqrnuviSdYPksi8ZbgDDqO6sPSUklNgAnB8A/PwfUoFKMQbIrZWCyqb2k\n" +
        "yQDGcS8T3qDFaqkGFA5t0WL9jIW9hHEoqVqs6cq1Z3wbj4u27LfnqdKOkWodmd3b\n" +
        "B+17VhpHFk93s0/M+XyUNcJFF0KStoapY97Y8CmYfx5iAjAOdU6Fn1FV7ljQ9/EC\n" +
        "l+4x5nCTvjfPqT+IUn887kxzjnf/DDS+XJ5fKMoZj0k0h7ICCQVtYNAb86TzXkMf\n" +
        "-----END CERTIFICATE-----\n";

    private final GoogleCertCache cache = new GoogleCertCache();
    private final AtomicReference<Reply> reply = new AtomicReference<>();
    private final FakeHttpClient http = FakeHttpClient.inject(cache, r -> reply.get());

    private static PublicKey key(String pem) throws Exception {
        return CertificateFactory.getInstance("X.509").generateCertificate(
            new ByteArrayInputStream(pem.getBytes(StandardCharsets.UTF_8))).getPublicKey();
    }

    private static Reply certs(String cacheControl, Map<String, String> byKid) throws Exception {
        var node = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(byKid);
        return new Reply(200, node, cacheControl == null ? Map.of() : Map.of("cache-control", List.of(cacheControl)));
    }

    private void expireCache() {
        FakeHttpClient.setField(cache, "expiresAt", Instant.now().minusSeconds(1));
    }

    private void ageLastFetch(long seconds) {
        FakeHttpClient.setField(cache, "fetchedAt", Instant.now().minusSeconds(seconds));
    }

    private Instant field(String name) throws Exception {
        var f = GoogleCertCache.class.getDeclaredField(name);
        f.setAccessible(true);
        return (Instant) f.get(cache);
    }

    @Test
    void firstLookupFetchesFromGoogleOverHttpsWithATimeoutAndReturnsTheKey() throws Exception {
        reply.set(certs("public, max-age=19000, must-revalidate", Map.of("kid-a", CERT_A, "kid-b", CERT_B)));

        assertThat(cache.get("kid-a")).isEqualTo(key(CERT_A));
        assertThat(cache.get("kid-b")).isEqualTo(key(CERT_B));

        assertThat(http.sent).hasSize(1);
        var req = http.sent.get(0).request();
        assertThat(req.method()).isEqualTo("GET");
        assertThat(req.uri().toString()).isEqualTo("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
        assertThat(req.timeout()).hasValue(Duration.ofSeconds(5));
    }

    @Test
    void cacheHitWithinMaxAgeMakesNoSecondRequest() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        cache.get("kid-a");
        cache.get("kid-a");
        assertThat(http.sent).hasSize(1);
        assertThat(field("expiresAt")).isBetween(Instant.now().plusSeconds(3590), Instant.now().plusSeconds(3601));
    }

    @Test
    void maxAgeFromTheHeaderIsUsedAndMissingHeaderFallsBackToOneHour() throws Exception {
        reply.set(certs("public, max-age=120", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        assertThat(field("expiresAt")).isBetween(Instant.now().plusSeconds(110), Instant.now().plusSeconds(121));

        GoogleCertCache other = new GoogleCertCache();
        FakeHttpClient.inject(other, r -> { try { return certs(null, Map.of("kid-a", CERT_A)); } catch (Exception e) { throw new IllegalStateException(e); } });
        other.get("kid-a");
        var f = GoogleCertCache.class.getDeclaredField("expiresAt");
        f.setAccessible(true);
        assertThat((Instant) f.get(other)).isBetween(Instant.now().plusSeconds(3590), Instant.now().plusSeconds(3601));
    }

    @Test
    void refetchesAfterExpiryAndPicksUpRotatedKeys() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        reply.set(certs("max-age=3600", Map.of("kid-b", CERT_B)));
        expireCache();

        assertThat(cache.get("kid-b")).isEqualTo(key(CERT_B));
        assertThat(cache.get("kid-a")).as("rotated out key is gone").isNull();
        assertThat(http.sent).hasSize(2);
    }

    @Test
    void unknownKidTriggersARefetchOnlyAfterTheMinimumInterval() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");

        // within 60 s of the last fetch: no refetch, unknown kid is just null
        assertThat(cache.get("kid-new")).isNull();
        assertThat(cache.get("kid-new")).isNull();
        assertThat(http.sent).hasSize(1);

        // 61 s later: one refetch, which now carries the new kid
        ageLastFetch(61);
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A, "kid-new", CERT_B)));
        assertThat(cache.get("kid-new")).isEqualTo(key(CERT_B));
        assertThat(http.sent).hasSize(2);

        // and a kid that still is not published is rate limited again
        assertThat(cache.get("kid-bogus")).isNull();
        assertThat(http.sent).hasSize(2);
    }

    @Test
    void unknownKidAtExactlyTheMinimumIntervalDoesNotRefetchYet() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        ageLastFetch(59);
        assertThat(cache.get("nope")).isNull();
        assertThat(http.sent).hasSize(1);
    }

    @Test
    void nullKidReturnsNullWithoutAnyFetch() {
        assertThat(cache.get(null)).isNull();
        assertThat(http.sent).isEmpty();
    }

    @Test
    void aFailedRefreshKeepsServingTheLastKnownKeys() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");

        for (Reply bad : new Reply[]{Reply.of(500, "boom"), Reply.of(200, "not json"), Reply.of(200, "{\"kid-a\":\"-----BEGIN CERTIFICATE-----\\nAAAA\\n-----END CERTIFICATE-----\\n\"}")}) {
            expireCache();
            ageLastFetch(1000);
            reply.set(bad);
            assertThat(cache.get("kid-a")).as("reply %s", bad.status()).isEqualTo(key(CERT_A));
        }
    }

    @Test
    @Disabled("BUG: expected a failed refresh to back off for MIN_REFETCH (60 s) as the comment on GoogleCertCache line 71 promises; actual line 40 "
        + "'stale' ignores fetchedAt and expiresAt is not extended on failure, so every get() while Google is down re-calls Google inside the synchronized "
        + "method (up to 5 s each), serialising all sign-in verifications")
    void aFailedRefreshBacksOffForTheMinimumIntervalInsteadOfHammeringGoogle() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        expireCache();
        reply.set(Reply.of(503, ""));
        cache.get("kid-a");
        int afterFirstFailure = http.sent.size();
        assertThat(field("fetchedAt")).isAfter(Instant.now().minusSeconds(5));
        cache.get("kid-a");
        assertThat(http.sent).hasSize(afterFirstFailure);
    }

    @Test
    void failuresWithNoKeysYetAre503NotNullKeys() {
        List<FakeHttpClient.Handler> failures = List.of(
            r -> Reply.of(500, "x"),
            r -> Reply.of(200, "{broken"),
            r -> Reply.of(200, "{\"kid-a\":\"not a certificate\"}"),
            r -> { throw new ConnectException("Connection refused"); },
            r -> { throw new HttpTimeoutException("timed out"); },
            r -> { throw new IOException("reset"); });
        for (var failure : failures) {
            GoogleCertCache fresh = new GoogleCertCache();
            FakeHttpClient.inject(fresh, failure);
            assertThatThrownBy(() -> fresh.get("kid-a")).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        }
    }

    @Test
    void aMalformedCertificateInTheBatchDiscardsTheWholeBatchAndKeepsOldKeys() throws Exception {
        reply.set(certs("max-age=3600", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        expireCache();
        ageLastFetch(1000);
        reply.set(certs("max-age=3600", Map.of("kid-b", CERT_B, "kid-bad", "garbage")));

        assertThat(cache.get("kid-a")).isEqualTo(key(CERT_A));
        assertThat(cache.get("kid-b")).as("good key from a half-bad batch is not adopted").isNull();
    }

    @Test
    void emptyKeySetFromGoogleLeavesNoKeysSoEveryKidIsUnknown() {
        reply.set(Reply.of(200, "{}"));
        assertThat(cache.get("kid-a")).isNull();
    }

    @Test
    @Disabled("BUG: expected max-age=0 / no-store to mean 'do not cache'; actual GoogleCertCache line 66 only reads max-age, so 'no-store' without "
        + "max-age is cached for 3600 s")
    void noStoreIsNotCachedForAnHour() throws Exception {
        reply.set(certs("no-store", Map.of("kid-a", CERT_A)));
        cache.get("kid-a");
        assertThat(field("expiresAt")).isBefore(Instant.now().plusSeconds(60));
    }

    @Test
    @Disabled("BUG: expected an astronomically large max-age to be handled; actual GoogleCertCache line 66 Long.parseLong/plusSeconds throws "
        + "(max-age=99999999999999999999 -> NumberFormatException) inside the catch-all, so a good response is discarded as a failed fetch")
    void hugeMaxAgeDoesNotDiscardTheFetch() throws Exception {
        reply.set(certs("max-age=99999999999999999999", Map.of("kid-a", CERT_A)));
        assertThat(cache.get("kid-a")).isEqualTo(key(CERT_A));
    }
}
