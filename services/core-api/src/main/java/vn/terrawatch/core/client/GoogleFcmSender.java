package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * FCM HTTP v1 with a Firebase service account: signs an RS256 JWT, exchanges it for an access token (cached until it
 * is about to expire) and posts the message. Uses only the JDK HTTP client and jjwt, no Firebase Admin SDK.
 */
public class GoogleFcmSender implements FcmSender {
    private static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final String clientEmail;
    private final PrivateKey privateKey;
    private final String projectId;
    private final URI tokenUri;
    private final String fcmBase;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ObjectMapper json;

    private String accessToken;
    private Instant accessTokenExpiry = Instant.EPOCH;

    public GoogleFcmSender(String clientEmail, PrivateKey privateKey, String projectId, URI tokenUri, String fcmBase, ObjectMapper json) {
        this.clientEmail = clientEmail;
        this.privateKey = privateKey;
        this.projectId = projectId;
        this.tokenUri = tokenUri;
        this.fcmBase = fcmBase;
        this.json = json;
    }

    /** Reads a service account key file downloaded from the Firebase console. */
    public static GoogleFcmSender fromFile(Path file, ObjectMapper json) throws IOException, java.security.GeneralSecurityException {
        JsonNode key = json.readTree(Files.readString(file));
        String pem = key.get("private_key").asText().replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        PrivateKey privateKey = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(pem)));
        URI tokenUri = URI.create(key.hasNonNull("token_uri") ? key.get("token_uri").asText() : "https://oauth2.googleapis.com/token");
        return new GoogleFcmSender(key.get("client_email").asText(), privateKey, key.get("project_id").asText(), tokenUri,
            "https://fcm.googleapis.com", json);
    }

    @Override
    public Result send(String fcmToken, Message message) {
        try {
            Map<String, Object> notification = new LinkedHashMap<>();
            notification.put("title", message.title());
            notification.put("body", message.body());
            Map<String, Object> androidNotification = Map.of("channel_id", "emergency_alarm");
            Map<String, Object> body = Map.of("message", Map.of(
                "token", fcmToken,
                "notification", notification,
                "data", message.data(),
                "android", Map.of("priority", "HIGH", "notification", androidNotification)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(fcmBase + "/v1/projects/" + projectId + "/messages:send"))
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + accessToken())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 == 2) return Result.sent();
            String detail = "FCM " + response.statusCode() + ": " + abbreviate(response.body());
            // UNREGISTERED (404) and a token FCM calls invalid (400 INVALID_ARGUMENT on the token field) mean the phone is gone
            if (response.statusCode() == 404 || response.body().contains("UNREGISTERED")) return Result.unregisteredToken(detail);
            return Result.failed(detail);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("FCM request interrupted");
        } catch (Exception e) {
            return Result.failed("FCM unreachable: " + e.getMessage());
        }
    }

    private synchronized String accessToken() throws IOException, InterruptedException {
        if (accessToken != null && Instant.now().isBefore(accessTokenExpiry.minusSeconds(60))) return accessToken;
        Instant now = Instant.now();
        String assertion = Jwts.builder().issuer(clientEmail).subject(clientEmail)
            // single(): Google's token endpoint rejects an `aud` that is a JSON array (found against the real endpoint)
            .audience().single(tokenUri.toString())
            .claim("scope", SCOPE)
            .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(3600)))
            .signWith(privateKey, Jwts.SIG.RS256).compact();
        String form = "grant_type=" + URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer", StandardCharsets.UTF_8)
            + "&assertion=" + URLEncoder.encode(assertion, StandardCharsets.UTF_8);
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(tokenUri).timeout(TIMEOUT)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new IOException("FCM auth failed " + response.statusCode() + ": " + abbreviate(response.body()));
        JsonNode token = json.readTree(response.body());
        accessToken = token.get("access_token").asText();
        accessTokenExpiry = now.plusSeconds(token.path("expires_in").asLong(3600));
        return accessToken;
    }

    private static String abbreviate(String text) {
        return text.length() <= 300 ? text : text.substring(0, 300) + "...";
    }
}
