package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.terrawatch.core.testsupport.FakeHttpClient;
import vn.terrawatch.core.testsupport.FakeHttpClient.Reply;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Gaps left by GoogleFcmSenderTest: token cache expiry and 401 reset, error mapping, timeouts, key-file loading and config fallbacks. */
class GoogleFcmSenderGapsTest {
    private static final String TOKEN_OK = "{\"access_token\":\"ya29.%d\",\"expires_in\":%d}";
    private final ObjectMapper json = new ObjectMapper();
    private final KeyPair keys = newKeys();
    private final GoogleFcmSender sender = new GoogleFcmSender("svc@p.iam.gserviceaccount.com", keys.getPrivate(), "proj",
        URI.create("https://oauth.test/token"), "https://fcm.test", json);
    private final AtomicInteger tokens = new AtomicInteger();
    private volatile int fcmStatus = 200;
    private volatile String fcmBody = "{}";
    private volatile int expiresIn = 3600;
    private final FakeHttpClient http = FakeHttpClient.inject(sender, r -> {
        if (r.request().uri().getHost().equals("oauth.test")) {
            return Reply.of(200, TOKEN_OK.formatted(tokens.incrementAndGet(), expiresIn));
        }
        return Reply.of(fcmStatus, fcmBody);
    });

    private static KeyPair newKeys() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
            g.initialize(2048);
            return g.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static FcmSender.Message msg() {
        return new FcmSender.Message("T", "B", Map.of("k", "v"));
    }

    private long fcmCalls() {
        return http.sent.stream().filter(s -> s.request().uri().getHost().equals("fcm.test")).count();
    }

    @Test
    void anAccessTokenThatExpiresWithinAMinuteIsRefreshedBeforeTheNextSend() {
        expiresIn = 30; // inside the 60 s safety margin: never reusable
        sender.send("a", msg());
        sender.send("b", msg());
        assertThat(tokens.get()).isEqualTo(2);
        assertThat(http.sent.get(http.sent.size() - 1).header("Authorization")).isEqualTo("Bearer ya29.2");
    }

    @Test
    void anExpiredCachedTokenIsRefreshed() {
        sender.send("a", msg());
        FakeHttpClient.setField(sender, "accessTokenExpiry", Instant.now().minusSeconds(1));
        sender.send("b", msg());
        assertThat(tokens.get()).isEqualTo(2);
    }

    @Test
    void aFcm401DropsTheCachedTokenSoTheNextSendReauthenticates() {
        assertThat(sender.send("a", msg()).ok()).isTrue();
        fcmStatus = 401;
        fcmBody = "{\"error\":{\"status\":\"UNAUTHENTICATED\"}}";
        FcmSender.Result r = sender.send("a", msg());
        assertThat(r.ok()).isFalse();
        assertThat(r.unregistered()).isFalse();
        assertThat(r.error()).startsWith("FCM 401");
        fcmStatus = 200;
        assertThat(sender.send("a", msg()).ok()).isTrue();
        assertThat(tokens.get()).isEqualTo(2);
    }

    @Test
    void unregisteredIsDetectedByStatus404OrByTheErrorCodeAnyStatus() {
        fcmStatus = 404;
        fcmBody = "{}";
        assertThat(sender.send("a", msg()).unregistered()).isTrue();
        fcmStatus = 400;
        fcmBody = "{\"error\":{\"details\":[{\"errorCode\":\"UNREGISTERED\"}]}}";
        assertThat(sender.send("a", msg()).unregistered()).isTrue();
    }

    @Test
    void otherClientAndServerErrorsAreFailedButNotUnregistered() {
        for (int status : new int[]{400, 403, 429, 500, 503}) {
            fcmStatus = status;
            fcmBody = "{\"error\":{\"status\":\"INVALID_ARGUMENT\"}}";
            FcmSender.Result r = sender.send("a", msg());
            assertThat(r.ok()).as("status %s", status).isFalse();
            assertThat(r.unregistered()).as("status %s", status).isFalse();
            assertThat(r.error()).startsWith("FCM " + status);
        }
    }

    @Test
    void allTwoXxStatusesCountAsSent() {
        fcmStatus = 204;
        fcmBody = "";
        assertThat(sender.send("a", msg()).ok()).isTrue();
    }

    @Test
    void longErrorBodiesAreAbbreviatedAndTheBearerTokenIsNotEchoedInErrors() {
        fcmStatus = 500;
        fcmBody = "x".repeat(1000);
        FcmSender.Result r = sender.send("a", msg());
        assertThat(r.error()).hasSizeLessThan(330).endsWith("...");
        assertThat(r.error()).doesNotContain("ya29");
    }

    @Test
    void timeoutAndConnectionRefusedOnTheFcmCallAreFailures() {
        sender.send("a", msg()); // warm the token
        for (IOException e : new IOException[]{new HttpTimeoutException("timed out"), new ConnectException("Connection refused"), new IOException("reset")}) {
            http.respondWith(r -> { throw e; });
            FcmSender.Result r = sender.send("a", msg());
            assertThat(r.ok()).isFalse();
            assertThat(r.error()).startsWith("FCM unreachable");
        }
    }

    @Test
    void theFcmAndTokenRequestsCarryATenSecondTimeout() {
        sender.send("a", msg());
        assertThat(http.sent).allSatisfy(s -> assertThat(s.request().timeout()).hasValue(Duration.ofSeconds(10)));
    }

    @Test
    void interruptionIsAFailureAndKeepsTheFlag() {
        http.respondWith(r -> { throw new InterruptedException(); });
        try {
            assertThat(sender.send("a", msg()).error()).isEqualTo("FCM request interrupted");
            assertThat(Thread.currentThread().isInterrupted()).isTrue();
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void tokenEndpointFailuresAndMalformedReplyFailTheSendWithoutCallingFcm() {
        http.respondWith(r -> Reply.of(500, "boom"));
        assertThat(sender.send("a", msg()).error()).contains("FCM auth failed 500");
        http.respondWith(r -> Reply.of(200, "{\"no_token\":true}"));
        assertThat(sender.send("a", msg()).ok()).isFalse();
        http.respondWith(r -> Reply.of(200, "not json"));
        assertThat(sender.send("a", msg()).ok()).isFalse();
        assertThat(fcmCalls()).isZero();
    }

    @Test
    void nullDataOrTokenIsAFailureNotAnException() {
        assertThat(sender.send("a", new FcmSender.Message("T", "B", null)).ok()).isFalse();
        assertThat(sender.send(null, msg()).ok()).isFalse();
        assertThat(fcmCalls()).isZero();
    }

    @Test
    void fromFileReadsTheServiceAccountAndFallsBackToTheDefaultTokenUri(@TempDir Path dir) throws Exception {
        String pem = "-----BEGIN PRIVATE KEY-----\n" + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(keys.getPrivate().getEncoded())
            + "\n-----END PRIVATE KEY-----\n";
        Path file = dir.resolve("sa.json");
        Files.writeString(file, json.writeValueAsString(Map.of("client_email", "svc@p.iam", "project_id", "proj", "private_key", pem)));

        GoogleFcmSender s = GoogleFcmSender.fromFile(file, json);
        FakeHttpClient fake = FakeHttpClient.inject(s, r -> r.request().uri().getHost().equals("oauth2.googleapis.com")
            ? Reply.of(200, "{\"access_token\":\"t\",\"expires_in\":3600}") : Reply.of(200, "{}"));

        assertThat(s.send("a", msg()).ok()).isTrue();
        assertThat(fake.sent.get(0).request().uri().toString()).isEqualTo("https://oauth2.googleapis.com/token");
        assertThat(fake.sent.get(1).request().uri().toString()).isEqualTo("https://fcm.googleapis.com/v1/projects/proj/messages:send");
        JsonNode sentBody = json.readTree(fake.sent.get(1).body());
        assertThat(sentBody.at("/message/token").asText()).isEqualTo("a");
    }

    @Test
    void fromFileRejectsBrokenKeyFiles(@TempDir Path dir) throws Exception {
        Path bad = dir.resolve("bad.json");
        Files.writeString(bad, "{\"client_email\":\"x\",\"project_id\":\"p\",\"private_key\":\"-----BEGIN PRIVATE KEY-----\\nAAAA\\n-----END PRIVATE KEY-----\"}");
        assertThatThrownBy(() -> GoogleFcmSender.fromFile(bad, json)).isInstanceOf(java.security.GeneralSecurityException.class);
        Path missing = dir.resolve("missing.json");
        Files.writeString(missing, "{\"client_email\":\"x\"}");
        assertThatThrownBy(() -> GoogleFcmSender.fromFile(missing, json)).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> GoogleFcmSender.fromFile(dir.resolve("nope.json"), json)).isInstanceOf(IOException.class);
    }

    @Test
    void notConfiguredOrUnusableServiceAccountFailsWithoutAnyPush(@TempDir Path dir) throws Exception {
        var config = new vn.terrawatch.core.config.FcmConfig();
        FcmSender none = config.fcmSender("", json);
        assertThat(none.send("a", msg())).isEqualTo(FcmSender.Result.failed("FCM not configured"));
        FcmSender unreadable = config.fcmSender(dir.resolve("absent.json").toString(), json);
        assertThat(unreadable.send("a", msg()).error()).isEqualTo("FCM not configured");
        Path broken = dir.resolve("broken.json");
        Files.writeString(broken, "not json");
        FcmSender unusable = config.fcmSender(broken.toString(), json);
        FcmSender.Result r = unusable.send("a", msg());
        assertThat(r.ok()).isFalse();
        assertThat(r.error()).startsWith("FCM service account unusable");
    }

    @Test
    @Disabled("BUG: expected a 400 INVALID_ARGUMENT 'registration token is not a valid FCM registration token' to mean the token is dead and should be forgotten; "
        + "actual GoogleFcmSender line 90 only treats 404 or the string UNREGISTERED as unregistered, so a malformed token stays in the DB and fails on every broadcast")
    void invalidRegistrationTokenIsForgotten() {
        fcmStatus = 400;
        fcmBody = "{\"error\":{\"status\":\"INVALID_ARGUMENT\",\"message\":\"The registration token is not a valid FCM registration token\"}}";
        assertThat(sender.send("a", msg()).unregistered()).isTrue();
    }

    @Test
    @Disabled("BUG: expected a token-exchange 200 with expires_in <= 0 to be treated as unusable; actual GoogleFcmSender line 116 accepts it and "
        + "re-authenticates on every send (benign), and a 200 reply with an empty access_token string is sent as 'Bearer ' (line 115)")
    void emptyAccessTokenIsRejected() {
        http.respondWith(r -> Reply.of(200, "{\"access_token\":\"\",\"expires_in\":3600}"));
        assertThat(sender.send("a", msg()).ok()).isFalse();
        assertThat(fcmCalls()).isZero();
    }
}
