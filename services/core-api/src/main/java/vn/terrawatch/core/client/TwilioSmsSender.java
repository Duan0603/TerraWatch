package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.util.Base64;

/**
 * Twilio SMS via JDK HttpClient + Basic Auth. No Twilio SDK needed.
 * Also hosts phone normalizer and GSM-7 SMS templates (ponytail: no separate classes).
 */
public class TwilioSmsSender implements SmsSender {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final String accountSid;
    private final String fromNumber;
    private final String authHeader;
    private final URI endpoint;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ObjectMapper json;

    public TwilioSmsSender(String accountSid, String authToken, String fromNumber, ObjectMapper json) {
        this.accountSid = accountSid;
        this.fromNumber = fromNumber;
        this.authHeader = "Basic " + Base64.getEncoder().encodeToString(
                (accountSid + ":" + authToken).getBytes(StandardCharsets.UTF_8));
        this.endpoint = URI.create("https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json");
        this.json = json;
    }

    @Override
    public Result send(String phoneNumber, String body) {
        try {
            String form = "To=" + enc(normalizeE164(phoneNumber))
                    + "&From=" + enc(fromNumber)
                    + "&Body=" + enc(body);
            HttpRequest req = HttpRequest.newBuilder(endpoint).timeout(TIMEOUT)
                    .header("Authorization", authHeader)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = json.readTree(resp.body());
            if (resp.statusCode() == 201) {
                return Result.sent(node.path("sid").asText());
            }
            return Result.failed("Twilio " + resp.statusCode() + ": " + node.path("message").asText(resp.body()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("SMS request interrupted");
        } catch (Exception e) {
            return Result.failed("SMS unreachable: " + e.getMessage());
        }
    }

    // ─── Phone normalizer ───────────────────────────────────────────────

    /** Vietnamese 0xxx → +84xxx, 84xxx → +84xxx, already +xxx → passthrough. */
    public static String normalizeE164(String phone) {
        if (phone == null || phone.isBlank()) return phone;
        String p = phone.strip().replaceAll("[^0-9+]", "");
        if (p.startsWith("+")) return p;
        if (p.startsWith("0")) return "+84" + p.substring(1);
        return "+" + p;
    }

    // ─── GSM-7 Vietnamese diacritics stripper ───────────────────────────

    /** Strip combining marks (NFD) + đ/Đ special case → GSM-7 safe ASCII. */
    public static String stripDiacritics(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D');
    }

    // ─── Phase-specific SMS templates (≤160 chars GSM-7) ────────────────

    /** Build SMS body for the given incident phase. Already stripped of diacritics. */
    public static String smsBody(String phase, String areaName, String riskLevel, String hotline) {
        String area = stripDiacritics(areaName);
        String risk = riskLevel == null ? "CAO" : riskLevel.toUpperCase();
        String hl = hotline == null || hotline.isBlank() ? "112" : hotline;
        String text = switch (phase == null ? "" : phase) {
            case "pre_incident" ->
                "[TERRAWATCH-CANH BAO SOM] Nguy co sat lo dat muc " + risk + " tai " + area + " trong 24h toi. Chu dong so tan. Hotline: " + hl;
            case "post_incident" ->
                "[TERRAWATCH-BAO AN] Canh bao sat lo tai " + area + " da ha muc AN TOAN. Tranh xa tuyen duong sat lo. Ho tro: " + hl;
            default -> // during_incident
                "[TERRAWATCH-KHAN CAP] SO TAN NGAY! Sat lo CUC KY NGUY HIEM tai " + area + ". Di chuyen den noi cao/diem tap trung. Cuu ho: " + hl + "!";
        };
        return text.length() <= 160 ? text : text.substring(0, 157) + "...";
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }
}

