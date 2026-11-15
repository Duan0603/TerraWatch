package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import vn.terrawatch.core.testsupport.FakeHttpClient;
import vn.terrawatch.core.testsupport.FakeHttpClient.Reply;

import java.io.IOException;
import java.net.ConnectException;
import java.net.http.HttpTimeoutException;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class EsmsSenderTest {
    private final ObjectMapper json = new ObjectMapper();

    private EsmsSender sender(boolean sandbox, String brand) {
        return new EsmsSender("key-123", "secret-456", brand, sandbox, json);
    }

    private static FakeHttpClient ok(EsmsSender s) {
        return FakeHttpClient.inject(s, r -> Reply.of(200, "{\"CodeResult\":\"100\",\"SMSID\":\"sms-9\"}"));
    }

    @Test
    void successIsOnlyCodeResult100AndCarriesTheSmsId() throws Exception {
        EsmsSender s = sender(true, "Brand");
        FakeHttpClient http = ok(s);

        SmsSender.Result r = s.send("+84 912-345-678", "hello");

        assertThat(r.ok()).isTrue();
        assertThat(r.providerMessageId()).isEqualTo("sms-9");
        var req = http.sent.get(0);
        assertThat(req.request().method()).isEqualTo("POST");
        assertThat(req.request().uri().toString()).isEqualTo("http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/");
        assertThat(req.header("Content-Type")).isEqualTo("application/json");
        assertThat(req.request().timeout()).hasValue(Duration.ofSeconds(10));
        JsonNode body = json.readTree(req.body());
        assertThat(body.get("Phone").asText()).isEqualTo("0912345678");
        assertThat(body.get("Content").asText()).isEqualTo("hello");
        assertThat(body.get("Brandname").asText()).isEqualTo("Brand");
        assertThat(body.get("Sandbox").asText()).isEqualTo("1");
        assertThat(body.get("ApiKey").asText()).isEqualTo("key-123");
        assertThat(body.get("SecretKey").asText()).isEqualTo("secret-456");
    }

    @Test
    void credentialsAreInTheBodyNeverInTheUrl() {
        EsmsSender s = sender(false, "Brand");
        FakeHttpClient http = ok(s);
        s.send("0912345678", "x");
        String uri = http.sent.get(0).request().uri().toString();
        assertThat(uri).doesNotContain("key-123").doesNotContain("secret-456").doesNotContain("?");
    }

    @Test
    void liveModeSendsTheBodyUntouchedForANormalBrandname() throws Exception {
        EsmsSender s = sender(false, "RealBrand");
        FakeHttpClient http = ok(s);
        s.send("0912345678", "original text");
        JsonNode body = json.readTree(http.sent.get(0).body());
        assertThat(body.get("Content").asText()).isEqualTo("original text");
        assertThat(body.get("Sandbox").asText()).isEqualTo("0");
    }

    @Test
    void liveBaotrixemayBrandnameRewritesTheBodyIntoTheCarrierTemplate() throws Exception {
        EsmsSender s = sender(false, "baotrixemay");
        FakeHttpClient http = ok(s);
        s.send("0912345678", "SO TAN KHAN CAP tai Xa Lung Phin, muc CAO.");
        String content = json.readTree(http.sent.get(0).body()).get("Content").asText();
        assertThat(content).startsWith("Xe [TERRAWATCH] So tan khan cap Xa Lung Phin (CAO) da hoan thanh.");
        // sandbox never rewrites
        EsmsSender sb = sender(true, "Baotrixemay");
        FakeHttpClient http2 = ok(sb);
        sb.send("0912345678", "raw");
        assertThat(json.readTree(http2.sent.get(0).body()).get("Content").asText()).isEqualTo("raw");
    }

    @Test
    void providerRejectionInAnHttp200BodyIsAFailureWithTheCodeAndMessage() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient.inject(s, r -> Reply.of(200, "{\"CodeResult\":\"101\",\"ErrorMessage\":\"Login invalid\"}"));
        SmsSender.Result r = s.send("0912345678", "x");
        assertThat(r.ok()).isFalse();
        assertThat(r.providerMessageId()).isNull();
        assertThat(r.error()).isEqualTo("eSMS 101: Login invalid");
    }

    @Test
    void rejectionWithoutMessageStillFails() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient.inject(s, r -> Reply.of(200, "{\"CodeResult\":\"104\"}"));
        assertThat(s.send("0912345678", "x").error()).isEqualTo("eSMS 104");
    }

    @Test
    void numericCodeResult100IsAlsoSuccess() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient.inject(s, r -> Reply.of(200, "{\"CodeResult\":100,\"SMSID\":\"n1\"}"));
        assertThat(s.send("0912345678", "x").ok()).isTrue();
    }

    @Test
    void emptyOrMalformedOrHtmlBodiesAreFailuresNotSent() {
        for (String body : new String[]{"", "not json", "<html>502 Bad Gateway</html>", "{}", "[]", "null"}) {
            EsmsSender s = sender(true, "B");
            FakeHttpClient.inject(s, r -> Reply.of(200, body));
            SmsSender.Result r = s.send("0912345678", "x");
            assertThat(r.ok()).as("body <%s>", body).isFalse();
            assertThat(r.error()).isNotBlank();
        }
    }

    @Test
    void http4xxAnd5xxWithoutTheSuccessCodeAreFailures() {
        for (int status : new int[]{400, 401, 403, 429, 500, 502, 503}) {
            EsmsSender s = sender(true, "B");
            FakeHttpClient.inject(s, r -> Reply.of(status, "{\"error\":\"x\"}"));
            assertThat(s.send("0912345678", "x").ok()).as("status %s", status).isFalse();
        }
    }

    @Test
    void timeoutAndConnectionRefusedAreFailuresNotExceptions() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient.inject(s, r -> { throw new HttpTimeoutException("request timed out"); });
        SmsSender.Result timeout = s.send("0912345678", "x");
        assertThat(timeout.ok()).isFalse();
        assertThat(timeout.error()).startsWith("eSMS unreachable");

        FakeHttpClient.inject(s, r -> { throw new ConnectException("Connection refused"); });
        assertThat(s.send("0912345678", "x").error()).contains("Connection refused");

        FakeHttpClient.inject(s, r -> { throw new IOException("reset"); });
        assertThat(s.send("0912345678", "x").ok()).isFalse();
    }

    @Test
    void interruptionIsAFailureAndKeepsTheInterruptFlag() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient.inject(s, r -> { throw new InterruptedException(); });
        try {
            assertThat(s.send("0912345678", "x")).isEqualTo(SmsSender.Result.failed("SMS request interrupted"));
            assertThat(Thread.currentThread().isInterrupted()).isTrue();
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void aSendIsNeverRetried() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient http = FakeHttpClient.inject(s, r -> Reply.of(500, "{}"));
        s.send("0912345678", "x");
        assertThat(http.sent).hasSize(1);
    }

    @Test
    void missingCredentialsFailWithoutAnyHttpCall() {
        EsmsSender s = new EsmsSender(null, null, "B", true, json);
        FakeHttpClient http = ok(s);
        SmsSender.Result r = s.send("0912345678", "x");
        assertThat(r.ok()).isFalse();
        assertThat(http.sent).isEmpty();
    }

    @Test
    void localPhoneNormalisation() {
        assertThat(EsmsSender.normalizeLocal("+84912345678")).isEqualTo("0912345678");
        assertThat(EsmsSender.normalizeLocal("84912345678")).isEqualTo("0912345678");
        assertThat(EsmsSender.normalizeLocal("0912 345 678")).isEqualTo("0912345678");
        assertThat(EsmsSender.normalizeLocal("912345678")).isEqualTo("0912345678");
        assertThat(EsmsSender.normalizeLocal(" (091) 234-5678 ")).isEqualTo("0912345678");
        assertThat(EsmsSender.normalizeLocal(null)).isEmpty();
        assertThat(EsmsSender.normalizeLocal("  ")).isEmpty();
    }

    @Test
    void carrierTemplateEdgeCases() {
        assertThat(EsmsSender.toCarrierTemplate(null)).startsWith("Xe [TERRAWATCH] Canh bao sat lo");
        assertThat(EsmsSender.toCarrierTemplate("  ")).contains("112");
        assertThat(EsmsSender.toCarrierTemplate("nothing useful")).startsWith("Xe [TERRAWATCH] Canh bao som Khu vuc da hoan thanh.");
        assertThat(EsmsSender.toCarrierTemplate("AN TOAN tai X")).contains("Bao an sat lo X");
        assertThat(EsmsSender.toCarrierTemplate("BAO AN tai X")).contains("Bao an sat lo");
        String longArea = EsmsSender.toCarrierTemplate("KHAN CAP tai Vung trong diem 3: " + "A".repeat(80) + " muc CAO");
        String param = longArea.substring("Xe ".length(), longArea.indexOf(" da hoan thanh"));
        assertThat(param.length()).isLessThanOrEqualTo(60);
        assertThat(param).doesNotContain("...");
    }

    @Test
    @Disabled("BUG: expected API key and secret key not sent over cleartext HTTP; actual EsmsSender line 24 ENDPOINT is http://rest.esms.vn and "
        + "line 58 puts ApiKey/SecretKey in the request body")
    void endpointIsHttps() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient http = ok(s);
        s.send("0912345678", "x");
        assertThat(http.sent.get(0).request().uri().getScheme()).isEqualTo("https");
    }

    @Test
    @Disabled("BUG: expected blank phone to fail locally without calling the provider; actual EsmsSender.send line 45 normalises to \"\" and posts Phone=\"\"")
    void blankPhoneMakesNoHttpCall() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient http = ok(s);
        assertThat(s.send("  ", "x").ok()).isFalse();
        assertThat(http.sent).isEmpty();
    }

    @Test
    @Disabled("BUG: expected a 200-with-garbage reply 'CodeResult' missing to say so; actual error is just 'eSMS ' (EsmsSender line 80), no detail for the operator")
    void missingCodeResultErrorIsDescriptive() {
        EsmsSender s = sender(true, "B");
        FakeHttpClient.inject(s, r -> Reply.of(200, "{}"));
        assertThat(s.send("0912345678", "x").error()).containsIgnoringCase("CodeResult");
    }
}
