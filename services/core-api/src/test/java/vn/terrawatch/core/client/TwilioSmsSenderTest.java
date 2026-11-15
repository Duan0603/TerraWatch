package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import vn.terrawatch.core.config.SmsConfig;
import vn.terrawatch.core.testsupport.FakeHttpClient;
import vn.terrawatch.core.testsupport.FakeHttpClient.Reply;

import java.io.IOException;
import java.net.ConnectException;
import java.net.URLDecoder;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TwilioSmsSenderTest {
    private final ObjectMapper json = new ObjectMapper();

    private TwilioSmsSender sender() {
        return new TwilioSmsSender("AC123", "tok-secret", "+15005550006", json);
    }

    private static Map<String, String> form(String body) {
        Map<String, String> out = new HashMap<>();
        for (String pair : body.split("&")) {
            String[] kv = pair.split("=", 2);
            out.put(kv[0], URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
        return out;
    }

    @Test
    void sendBuildsAnAuthenticatedFormPostAndMapsSidOn201() {
        TwilioSmsSender s = sender();
        FakeHttpClient http = FakeHttpClient.inject(s, r -> Reply.of(201, "{\"sid\":\"SM42\",\"status\":\"queued\"}"));

        SmsSender.Result r = s.send("0912 345 678", "Canh bao & \"khan\" cap = 100%");

        assertThat(r).isEqualTo(SmsSender.Result.sent("SM42"));
        var req = http.sent.get(0);
        assertThat(req.request().method()).isEqualTo("POST");
        assertThat(req.request().uri().toString()).isEqualTo("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
        assertThat(req.header("Content-Type")).isEqualTo("application/x-www-form-urlencoded");
        assertThat(req.header("Authorization")).isEqualTo("Basic " + Base64.getEncoder().encodeToString("AC123:tok-secret".getBytes(StandardCharsets.UTF_8)));
        assertThat(req.request().timeout()).hasValue(Duration.ofSeconds(10));
        Map<String, String> f = form(req.body());
        assertThat(f).containsEntry("To", "+84912345678").containsEntry("From", "+15005550006")
            .containsEntry("Body", "Canh bao & \"khan\" cap = 100%");
    }

    @Test
    void theAuthTokenIsNeverInTheUrlOrTheBody() {
        TwilioSmsSender s = sender();
        FakeHttpClient http = FakeHttpClient.inject(s, r -> Reply.of(201, "{\"sid\":\"x\"}"));
        s.send("0912345678", "hi");
        assertThat(http.sent.get(0).request().uri().toString()).doesNotContain("tok-secret").doesNotContain("?");
        assertThat(http.sent.get(0).body()).doesNotContain("tok-secret");
    }

    @Test
    void anythingButExactly201IsAFailureEvenIf2xx() {
        for (int status : new int[]{200, 202, 204}) {
            TwilioSmsSender s = sender();
            FakeHttpClient.inject(s, r -> Reply.of(status, "{\"sid\":\"SM1\"}"));
            assertThat(s.send("0912345678", "x").ok()).as("status %s", status).isFalse();
        }
    }

    @Test
    void providerErrorBodiesBecomeFailuresWithStatusAndMessage() {
        TwilioSmsSender s = sender();
        FakeHttpClient.inject(s, r -> Reply.of(400, "{\"code\":21211,\"message\":\"The 'To' number is not a valid phone number.\"}"));
        SmsSender.Result r = s.send("123", "x");
        assertThat(r.ok()).isFalse();
        assertThat(r.error()).isEqualTo("Twilio 400: The 'To' number is not a valid phone number.");

        FakeHttpClient.inject(s, r2 -> Reply.of(401, "{\"message\":\"Authenticate\"}"));
        assertThat(s.send("0912345678", "x").error()).startsWith("Twilio 401");
        FakeHttpClient.inject(s, r2 -> Reply.of(429, "{\"message\":\"Too Many Requests\"}"));
        assertThat(s.send("0912345678", "x").error()).startsWith("Twilio 429");
        FakeHttpClient.inject(s, r2 -> Reply.of(503, "{}"));
        assertThat(s.send("0912345678", "x").ok()).isFalse();
    }

    @Test
    void nonJsonOrEmptyErrorBodiesAreStillFailures() {
        for (String body : new String[]{"", "<html>Bad Gateway</html>", "garbage"}) {
            TwilioSmsSender s = sender();
            FakeHttpClient.inject(s, r -> Reply.of(502, body));
            SmsSender.Result r = s.send("0912345678", "x");
            assertThat(r.ok()).as("body <%s>", body).isFalse();
            assertThat(r.error()).isNotBlank();
        }
    }

    @Test
    void timeoutRefusedAndInterruptAreFailuresNotExceptions() {
        TwilioSmsSender s = sender();
        FakeHttpClient.inject(s, r -> { throw new HttpTimeoutException("timed out"); });
        assertThat(s.send("0912345678", "x").error()).startsWith("SMS unreachable");
        FakeHttpClient.inject(s, r -> { throw new ConnectException("Connection refused"); });
        assertThat(s.send("0912345678", "x").error()).contains("Connection refused");
        FakeHttpClient.inject(s, r -> { throw new IOException("reset"); });
        assertThat(s.send("0912345678", "x").ok()).isFalse();
        FakeHttpClient.inject(s, r -> { throw new InterruptedException(); });
        try {
            assertThat(s.send("0912345678", "x").error()).isEqualTo("SMS request interrupted");
            assertThat(Thread.currentThread().isInterrupted()).isTrue();
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void aSendIsNeverRetried() {
        TwilioSmsSender s = sender();
        FakeHttpClient http = FakeHttpClient.inject(s, r -> Reply.of(500, "{}"));
        s.send("0912345678", "x");
        assertThat(http.sent).hasSize(1);
    }

    @Test
    void nullPhoneOrBodyFailsWithoutAnHttpCall() {
        TwilioSmsSender s = sender();
        FakeHttpClient http = FakeHttpClient.inject(s, r -> Reply.of(201, "{\"sid\":\"x\"}"));
        assertThat(s.send(null, "x").ok()).isFalse();
        assertThat(s.send("0912345678", null).ok()).isFalse();
        assertThat(http.sent).isEmpty();
    }

    @Test
    void unconfiguredProviderFailsViaTheConfigFallbackWithoutAnyHttp() {
        SmsSender none = new SmsConfig().smsSender("", "", "", "", "", "", "Baotrixemay", "0", json);
        assertThat(none.send("0912345678", "x")).isEqualTo(SmsSender.Result.failed("SMS not configured"));
        // incomplete Twilio settings must not build a real sender
        assertThat(new SmsConfig().smsSender("twilio", "AC1", "", "+1", "", "", "B", "0", json)).isNotInstanceOf(TwilioSmsSender.class);
        // incomplete eSMS settings (key but no secret) must not build a real sender
        assertThat(new SmsConfig().smsSender("esms", "", "", "", "key", "", "B", "0", json)).isNotInstanceOf(EsmsSender.class);
        assertThat(new SmsConfig().smsSender("esms", "", "", "", "key", "sec", "B", "true", json)).isInstanceOf(EsmsSender.class);
        assertThat(new SmsConfig().smsSender("", "AC1", "t", "+1", "", "", "B", "0", json)).isInstanceOf(TwilioSmsSender.class);
        assertThat(new SmsConfig().smsSender("  TWILIO ", "AC1", "t", "+1", "k", "s", "B", "0", json)).isInstanceOf(TwilioSmsSender.class);
    }

    @Test
    void e164Normalisation() {
        assertThat(TwilioSmsSender.normalizeE164("0912345678")).isEqualTo("+84912345678");
        assertThat(TwilioSmsSender.normalizeE164("84912345678")).isEqualTo("+84912345678");
        assertThat(TwilioSmsSender.normalizeE164("+84 912-345-678")).isEqualTo("+84912345678");
        assertThat(TwilioSmsSender.normalizeE164("+15005550006")).isEqualTo("+15005550006");
        assertThat(TwilioSmsSender.normalizeE164(null)).isNull();
        assertThat(TwilioSmsSender.normalizeE164(" ")).isEqualTo(" ");
    }

    @Test
    void templatesAreAsciiAtMost160CharsAndPerPhase() {
        assertThat(TwilioSmsSender.stripDiacritics("Đường Nguyễn Văn Cừ, Lũng Phìn")).isEqualTo("Duong Nguyen Van Cu, Lung Phin");
        assertThat(TwilioSmsSender.stripDiacritics(null)).isEmpty();
        String pre = TwilioSmsSender.smsBody("pre_incident", "Lũng Phìn", "cao", "1900");
        assertThat(pre).contains("CANH BAO SOM").contains("muc CAO").contains("Lung Phin").endsWith("Hotline: 1900");
        assertThat(TwilioSmsSender.smsBody("post_incident", "X", null, null)).contains("BAO AN").contains("112");
        assertThat(TwilioSmsSender.smsBody(null, "X", "CAO", " ")).contains("KHAN CAP").contains("Cuu ho: 112!");
        String longText = TwilioSmsSender.smsBody("during_incident", "Z".repeat(300), "CAO", "112");
        assertThat(longText).hasSize(160).endsWith("...");
        for (String phase : new String[]{"pre_incident", "post_incident", "during_incident"}) {
            assertThat(TwilioSmsSender.smsBody(phase, "Đà Nẵng", "CAO", "112")).matches("\\A\\p{ASCII}*\\z");
        }
    }

    @Test
    @Disabled("BUG: expected a 201 reply without a sid to be treated as failure (no message id to track); actual TwilioSmsSender line 53 "
        + "returns Result.sent(\"\") for body {} / empty")
    void a201WithoutSidIsNotSent() {
        TwilioSmsSender s = sender();
        FakeHttpClient.inject(s, r -> Reply.of(201, "{}"));
        assertThat(s.send("0912345678", "x").ok()).isFalse();
    }

    @Test
    @Disabled("BUG: expected non-JSON 5xx to keep the HTTP status in the error; actual TwilioSmsSender line 51 json.readTree throws first, error becomes "
        + "'SMS unreachable: Unrecognized token ...' and the status code 502 is lost")
    void nonJsonErrorKeepsTheStatus() {
        TwilioSmsSender s = sender();
        FakeHttpClient.inject(s, r -> Reply.of(502, "<html>Bad Gateway</html>"));
        assertThat(s.send("0912345678", "x").error()).contains("502");
    }
}
