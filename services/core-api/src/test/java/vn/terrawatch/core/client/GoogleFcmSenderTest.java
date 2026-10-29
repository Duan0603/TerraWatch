package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** The FCM sender against a local stub of the Google token endpoint and the FCM v1 endpoint. */
class GoogleFcmSenderTest {
    private final ObjectMapper json = new ObjectMapper();
    private HttpServer server;
    private KeyPair keys;
    private GoogleFcmSender sender;
    private final AtomicInteger tokenCalls = new AtomicInteger();
    private final AtomicReference<String> assertion = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> fcmBody = new AtomicReference<>();
    private volatile int fcmStatus = 200;
    private volatile String fcmReply = "{}";
    private volatile int tokenStatus = 200;

    @BeforeEach
    void start() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        keys = generator.generateKeyPair();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/token", exchange -> {
            tokenCalls.incrementAndGet();
            String form = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            for (String pair : form.split("&")) {
                if (pair.startsWith("assertion=")) assertion.set(URLDecoder.decode(pair.substring("assertion=".length()), StandardCharsets.UTF_8));
            }
            reply(exchange, tokenStatus, tokenStatus == 200 ? "{\"access_token\":\"ya29.test\",\"expires_in\":3600}" : "{\"error\":\"invalid_grant\"}");
        });
        server.createContext("/v1/projects/test-proj/messages:send", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            fcmBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            reply(exchange, fcmStatus, fcmReply);
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        sender = new GoogleFcmSender("sender@test-proj.iam.gserviceaccount.com", keys.getPrivate(), "test-proj",
            URI.create(base + "/token"), base, json);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private static void reply(com.sun.net.httpserver.HttpExchange exchange, int status, String body) throws java.io.IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static FcmSender.Message message() {
        return new FcmSender.Message("Title", "Body", Map.of("type", "EMERGENCY_ALERT", "broadcastId", "b-1"));
    }

    @Test
    void sendsAnAndroidHighPriorityNotificationWithDataAfterSigningAValidJwt() throws Exception {
        FcmSender.Result result = sender.send("device-token-1", message());

        assertTrue(result.ok(), result.error());
        Claims claims = Jwts.parser().verifyWith(keys.getPublic()).build().parseSignedClaims(assertion.get()).getPayload();
        assertEquals("sender@test-proj.iam.gserviceaccount.com", claims.getIssuer());
        assertEquals("https://www.googleapis.com/auth/firebase.messaging", claims.get("scope"));
        assertTrue(claims.getAudience().iterator().next().endsWith("/token"));
        // Google rejects an array-valued aud ("Failed audience check"): the raw payload must carry a plain string
        String payload = new String(java.util.Base64.getUrlDecoder().decode(assertion.get().split("\\.")[1]), StandardCharsets.UTF_8);
        assertTrue(json.readTree(payload).get("aud").isTextual(), payload);
        assertEquals("Bearer ya29.test", authorization.get());

        JsonNode message = json.readTree(fcmBody.get()).get("message");
        assertEquals("device-token-1", message.get("token").asText());
        assertEquals("Title", message.get("notification").get("title").asText());
        assertEquals("Body", message.get("notification").get("body").asText());
        assertEquals("EMERGENCY_ALERT", message.get("data").get("type").asText());
        assertEquals("HIGH", message.get("android").get("priority").asText());
        assertEquals("emergency_alarm", message.get("android").get("notification").get("channel_id").asText());
    }

    @Test
    void reusesTheAccessTokenUntilItIsAboutToExpire() {
        sender.send("t1", message());
        sender.send("t2", message());
        assertEquals(1, tokenCalls.get());
    }

    @Test
    void aTokenFcmDoesNotKnowIsReportedAsUnregistered() {
        fcmStatus = 404;
        fcmReply = "{\"error\":{\"status\":\"NOT_FOUND\",\"details\":[{\"errorCode\":\"UNREGISTERED\"}]}}";
        FcmSender.Result result = sender.send("gone", message());
        assertFalse(result.ok());
        assertTrue(result.unregistered());
    }

    @Test
    void otherFailuresAreReturnedNotThrown() {
        fcmStatus = 500;
        fcmReply = "{\"error\":\"boom\"}";
        FcmSender.Result server = sender.send("t", message());
        assertFalse(server.ok());
        assertFalse(server.unregistered());
        assertTrue(server.error().startsWith("FCM 500"));

        tokenStatus = 401;
        GoogleFcmSender fresh = new GoogleFcmSender("sender@test-proj.iam.gserviceaccount.com", keys.getPrivate(), "test-proj",
            URI.create("http://127.0.0.1:" + this.server.getAddress().getPort() + "/token"), "http://127.0.0.1:" + this.server.getAddress().getPort(), json);
        FcmSender.Result auth = fresh.send("t", message());
        assertFalse(auth.ok());
        assertTrue(auth.error().contains("FCM auth failed 401"));

        this.server.stop(0);
        FcmSender.Result unreachable = fresh.send("t", message());
        assertFalse(unreachable.ok());
        assertNotNull(unreachable.error());
    }
}
