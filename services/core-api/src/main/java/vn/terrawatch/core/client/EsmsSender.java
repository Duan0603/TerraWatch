package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Domestic Vietnamese SMS gateway via eSMS.vn REST API.
 * Uses JDK HttpClient + Jackson ObjectMapper (ponytail: zero external SDK).
 */
public class EsmsSender implements SmsSender {
    private static final Logger log = LoggerFactory.getLogger(EsmsSender.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final URI ENDPOINT = URI.create("http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/");
    private static final Pattern PATTERN_AREA = Pattern.compile("tai\\s+(?:Vung trong diem \\d+:\\s*)?([^.,]+)");
    private static final Pattern PATTERN_RISK = Pattern.compile("muc\\s+([A-Z]+)");

    private final String apiKey;
    private final String secretKey;
    private final String brandname;
    private final boolean sandbox;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ObjectMapper json;

    public EsmsSender(String apiKey, String secretKey, String brandname, boolean sandbox, ObjectMapper json) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.brandname = brandname;
        this.sandbox = sandbox;
        this.json = json;
    }

    @Override
    public Result send(String phoneNumber, String body) {
        String phone = normalizeLocal(phoneNumber);
        // For test Brandname Baotrixemay in live mode (sandbox=0), Telco carriers (Viettel/Mobi/Vina)
        // require pre-approved carrier templates. Adapt body so SMS lands on real phones.
        String content = (!sandbox && "Baotrixemay".equalsIgnoreCase(brandname))
                ? toCarrierTemplate(body)
                : body;

        return doSend(phone, content);
    }

    private Result doSend(String phone, String content) {
        try {
            String payload = json.writeValueAsString(Map.of(
                    "ApiKey", apiKey,
                    "SecretKey", secretKey,
                    "Phone", phone,
                    "Content", content,
                    "Brandname", brandname,
                    "SmsType", "2",
                    "IsUnicode", "0",
                    "Sandbox", sandbox ? "1" : "0"
            ));

            HttpRequest req = HttpRequest.newBuilder(ENDPOINT).timeout(TIMEOUT)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = json.readTree(resp.body());
            String code = node.path("CodeResult").asText();
            if ("100".equals(code)) {
                return Result.sent(node.path("SMSID").asText());
            }
            String err = node.path("ErrorMessage").asText();
            return Result.failed("eSMS " + code + (err.isBlank() ? "" : ": " + err));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("SMS request interrupted");
        } catch (Exception e) {
            return Result.failed("eSMS unreachable: " + e.getMessage());
        }
    }

    /**
     * Maps alert body into Baotrixemay's pre-approved telco carrier template:
     * "Xe {P2,70} da hoan thanh. Kinh moi {P2,50} den nhan xe. Tran trong."
     * Parameter 1 must be strictly <= 60 chars and contain no ellipsis to guarantee carrier delivery.
     */
    static String toCarrierTemplate(String body) {
        if (body == null || body.isBlank()) {
            return "Xe [TERRAWATCH] Canh bao sat lo da hoan thanh. Kinh moi 112 (Cuu ho khan cap) den nhan xe. Tran trong.";
        }
        String phaseLabel = "Canh bao som";
        if (body.contains("KHAN CAP") || body.contains("SO TAN")) {
            phaseLabel = "So tan khan cap";
        } else if (body.contains("BAO AN") || body.contains("AN TOAN")) {
            phaseLabel = "Bao an sat lo";
        }

        String area = "Khu vuc";
        Matcher mArea = PATTERN_AREA.matcher(body);
        if (mArea.find()) {
            area = mArea.group(1).trim();
            if (area.length() > 25) area = area.substring(0, 25).trim();
        }

        String risk = "";
        Matcher mRisk = PATTERN_RISK.matcher(body);
        if (mRisk.find()) {
            risk = " (" + mRisk.group(1) + ")";
        }

        String alertPart = "[TERRAWATCH] " + phaseLabel + " " + area + risk;
        if (alertPart.length() > 60) {
            alertPart = alertPart.substring(0, 60).trim();
        }

        return "Xe " + alertPart + " da hoan thanh. Kinh moi 112 (Cuu ho khan cap) den nhan xe. Tran trong.";
    }

    /** Vietnamese local phone format 0xxx (eSMS expects standard local VN format). */
    public static String normalizeLocal(String phone) {
        if (phone == null || phone.isBlank()) return "";
        String p = phone.strip().replaceAll("[^0-9]", "");
        if (p.startsWith("84") && p.length() > 9) return "0" + p.substring(2);
        if (!p.startsWith("0")) return "0" + p;
        return p;
    }
}
