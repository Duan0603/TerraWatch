package vn.terrawatch.core.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.PublicKey;
import java.security.cert.CertificateFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Public signing keys of Firebase ID tokens (x509 certs published by Google), cached per Cache-Control max-age. */
class GoogleCertCache {
    private static final URI CERTS_URL = URI.create(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    private static final Pattern MAX_AGE = Pattern.compile("max-age=(\\d+)");
    private static final Duration MIN_REFETCH = Duration.ofSeconds(60);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json = new ObjectMapper();
    private Map<String, PublicKey> keys = Map.of();
    private Instant expiresAt = Instant.EPOCH;
    private Instant fetchedAt = Instant.EPOCH;

    /** Key for the token's {@code kid}, or null when Google does not publish it. */
    synchronized PublicKey get(String kid) {
        if (kid == null) {
            return null;
        }
        boolean stale = Instant.now().isAfter(expiresAt);
        boolean unknownKid = !keys.containsKey(kid) && Instant.now().isAfter(fetchedAt.plus(MIN_REFETCH));
        if (stale || unknownKid) {
            refresh();
        }
        return keys.get(kid);
    }

    private void refresh() {
        try {
            HttpResponse<String> response = http.send(
                HttpRequest.newBuilder(CERTS_URL).timeout(Duration.ofSeconds(5)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("status " + response.statusCode());
            }
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            Map<String, PublicKey> fresh = new HashMap<>();
            for (var entry : json.readTree(response.body()).properties()) {
                var cert = factory.generateCertificate(
                    new ByteArrayInputStream(entry.getValue().asText().getBytes(StandardCharsets.UTF_8)));
                fresh.put(entry.getKey(), cert.getPublicKey());
            }
            keys = fresh;
            fetchedAt = Instant.now();
            Matcher maxAge = MAX_AGE.matcher(response.headers().firstValue("cache-control").orElse(""));
            expiresAt = fetchedAt.plusSeconds(maxAge.find() ? Long.parseLong(maxAge.group(1)) : 3600);
        } catch (Exception error) {
            if (keys.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cannot verify Google sign-in right now");
            }
            fetchedAt = Instant.now(); // keep serving the last known keys, retry after MIN_REFETCH
        }
    }
}
