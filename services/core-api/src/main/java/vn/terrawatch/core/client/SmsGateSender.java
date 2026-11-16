package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * SMS through an Android phone running "SMS Gateway for Android" (https://docs.sms-gate.app), cloud mode: the phone
 * sends from its own SIM, so the text arrives untouched and from a normal number (no brandname needed).
 * shortcut: a 2xx means the cloud queued the message for the phone, not that the carrier delivered it; fine for a demo,
 * poll GET /messages/{id} if delivery status is ever needed. Only for a handful of recipients (personal SIM).
 */
public class SmsGateSender implements SmsSender {
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    static final URI ENDPOINT = URI.create("https://api.sms-gate.app/3rdparty/v1/messages");

    private final String authHeader;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

    public SmsGateSender(String username, String password, ObjectMapper json) {
        this.authHeader = username == null || username.isBlank() || password == null || password.isBlank() ? null
            : "Basic " + Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
        this.json = json;
    }

    @Override
    public Result send(String phoneNumber, String body) {
        if (authHeader == null) return Result.failed("SMS Gateway credentials missing");
        if (phoneNumber == null || phoneNumber.isBlank()) return Result.failed("No phone number");
        String to = TwilioSmsSender.normalizeE164(phoneNumber);
        try {
            String payload = json.writeValueAsString(Map.of("textMessage", Map.of("text", body), "phoneNumbers", List.of(to)));
            HttpRequest req = HttpRequest.newBuilder(ENDPOINT).timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .header("Authorization", authHeader)
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = resp.body() == null || resp.body().isBlank() ? json.nullNode() : json.readTree(resp.body());
            if (resp.statusCode() / 100 == 2) return Result.sent(node.path("id").asText(null));
            return Result.failed("SMS Gateway " + resp.statusCode() + ": " + node.path("message").asText(resp.body()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("SMS request interrupted");
        } catch (Exception e) {
            return Result.failed("SMS Gateway unreachable: " + e.getMessage());
        }
    }
}
