package vn.terrawatch.core.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.terrawatch.core.testsupport.FakeHttpClient;
import vn.terrawatch.core.testsupport.FakeHttpClient.Reply;

import java.net.ConnectException;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class SmsGateSenderTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void postsTheTextUntouchedToTheVietnameseNumberWithBasicAuth() throws Exception {
        SmsGateSender s = new SmsGateSender("user1", "pw1", json);
        FakeHttpClient http = FakeHttpClient.inject(s, r -> Reply.of(202, "{\"id\":\"msg-7\",\"state\":\"Pending\"}"));

        SmsSender.Result r = s.send("0912 345 678", "[TERRAWATCH-KHAN CAP] SO TAN NGAY!");

        assertThat(r.ok()).isTrue();
        assertThat(r.providerMessageId()).isEqualTo("msg-7");
        var req = http.sent.get(0);
        assertThat(req.request().uri()).isEqualTo(SmsGateSender.ENDPOINT);
        assertThat(req.request().uri().getScheme()).isEqualTo("https");
        assertThat(req.header("Authorization")).isEqualTo("Basic " + Base64.getEncoder().encodeToString("user1:pw1".getBytes()));
        JsonNode body = json.readTree(req.body());
        assertThat(body.at("/textMessage/text").asText()).isEqualTo("[TERRAWATCH-KHAN CAP] SO TAN NGAY!");
        assertThat(body.at("/phoneNumbers/0").asText()).isEqualTo("+84912345678");
    }

    @Test
    void rejectionsAndOutagesAreFailuresNeverExceptions() {
        SmsGateSender s = new SmsGateSender("u", "p", json);
        FakeHttpClient.inject(s, r -> Reply.of(401, "{\"message\":\"Unauthorized\"}"));
        assertThat(s.send("0912345678", "x").error()).isEqualTo("SMS Gateway 401: Unauthorized");

        FakeHttpClient.inject(s, r -> { throw new ConnectException("Connection refused"); });
        assertThat(s.send("0912345678", "x").error()).contains("unreachable");
    }

    @Test
    void missingCredentialsOrPhoneMakeNoHttpCall() {
        SmsGateSender noCreds = new SmsGateSender("", null, json);
        FakeHttpClient http = FakeHttpClient.inject(noCreds, r -> Reply.of(202, "{}"));
        assertThat(noCreds.send("0912345678", "x").ok()).isFalse();
        SmsGateSender s = new SmsGateSender("u", "p", json);
        FakeHttpClient http2 = FakeHttpClient.inject(s, r -> Reply.of(202, "{}"));
        assertThat(s.send("  ", "x").ok()).isFalse();
        assertThat(http.sent).isEmpty();
        assertThat(http2.sent).isEmpty();
    }
}
