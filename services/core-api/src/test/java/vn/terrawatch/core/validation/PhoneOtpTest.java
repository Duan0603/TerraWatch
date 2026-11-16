package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Story 4.44: phone codes texted by our own SMS sender, their limits, and the one-time token used at sign-up. */
class PhoneOtpTest extends ValidationTestBase {
    private static final String BASE = "/api/v1/auth/phone-otp/";

    private org.springframework.mock.web.MockHttpServletResponse post(String path, Object... body) throws Exception {
        return send(HttpMethod.POST, path, null, json.writeValueAsString(map(body))).getResponse();
    }

    private int status(String path, Object... body) throws Exception { return post(path, body).getStatus(); }

    /** A fresh VN number per test (the database is shared across tests in a run). */
    private static String phone() { return "09" + String.format("%08d", (int) (Math.random() * 100_000_000)); }

    private String e164(String phone) { return "+84" + phone.substring(1); }

    private long rows(String phone) { return count("core_schema.phone_otp_codes WHERE phone = '" + e164(phone) + "'"); }

    /** Asks for a code and returns the 6 digits from the texted message. */
    private String requestCode(String phone) throws Exception {
        clearInvocations(sms);
        assertThat(status(BASE + "request", "phoneNumber", phone)).isEqualTo(200);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(sms).send(eq(e164(phone)), body.capture());
        Matcher m = Pattern.compile("\\b(\\d{6})\\b").matcher(body.getValue());
        assertThat(m.find()).as("SMS carries a 6-digit code: " + body.getValue()).isTrue();
        return m.group(1);
    }

    private String token(String phone, String code) throws Exception {
        var res = post(BASE + "verify", "phoneNumber", phone, "code", code);
        assertThat(res.getStatus()).isEqualTo(200);
        return json.readValue(res.getContentAsString(), Map.class).get("phoneToken").toString();
    }

    @Test
    @DisplayName("request texts a 6-digit code to +84…, stores only its hash, valid 5 minutes; a resend within 60 s is 429")
    void requestAndResendGap() throws Exception {
        String p = phone();
        String code = requestCode(p);
        assertThat(rows(p)).isEqualTo(1);
        String hash = jdbc.queryForObject("SELECT code_hash FROM core_schema.phone_otp_codes WHERE phone = ?", String.class, e164(p));
        assertThat(hash).doesNotContain(code).startsWith("$2");
        Double minutes = jdbc.queryForObject("SELECT EXTRACT(EPOCH FROM (expires_at - created_at)) / 60 FROM core_schema.phone_otp_codes WHERE phone = ?", Double.class, e164(p));
        assertThat(minutes).isBetween(4.99, 5.01);
        assertThat(status(BASE + "request", "phoneNumber", p)).isEqualTo(429);
        jdbc.update("UPDATE core_schema.phone_otp_codes SET created_at = now() - interval '61 seconds' WHERE phone = ?", e164(p));
        assertThat(status(BASE + "request", "phoneNumber", p)).isEqualTo(200);
    }

    @Test
    @DisplayName("5 codes per number per hour, 30 per hour in total")
    void hourlyLimits() throws Exception {
        String p = phone();
        for (int i = 0; i < 5; i++) jdbc.update("INSERT INTO core_schema.phone_otp_codes (phone, code_hash, expires_at, created_at) VALUES (?, 'x', now(), now() - interval '10 minutes')", e164(p));
        assertThat(status(BASE + "request", "phoneNumber", p)).isEqualTo(429);
        jdbc.update("DELETE FROM core_schema.phone_otp_codes WHERE created_at > now() - interval '2 hours'");
        for (int i = 0; i < 30; i++) jdbc.update("INSERT INTO core_schema.phone_otp_codes (phone, code_hash, expires_at, created_at) VALUES (?, 'x', now(), now() - interval '10 minutes')", e164(phone()));
        assertThat(status(BASE + "request", "phoneNumber", phone())).isEqualTo(429);
    }

    @Test
    @DisplayName("a failed SMS is 503 and keeps no code; SMS not configured says so")
    void failedSend() throws Exception {
        String p = phone();
        when(sms.send(anyString(), anyString())).thenReturn(vn.terrawatch.core.client.SmsSender.Result.failed("SMS not configured"));
        var res = post(BASE + "request", "phoneNumber", p);
        assertThat(res.getStatus()).isEqualTo(503);
        assertThat(res.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).contains("chưa bật gửi SMS");
        assertThat(rows(p)).isZero();
    }

    @Test
    @DisplayName("bad numbers are 400 before any SMS")
    void badNumber() throws Exception {
        clearInvocations(sms);
        for (String bad : new String[] {"12345", "0912 345 67", "+1 202 555 0100", "08123456789"}) {
            assertThat(status(BASE + "request", "phoneNumber", bad)).as(bad).isEqualTo(400);
        }
        verify(sms, org.mockito.Mockito.never()).send(anyString(), anyString());
    }

    @Test
    @DisplayName("5 wrong codes kill the code; the right one before that gives a token")
    void attempts() throws Exception {
        String ok = phone(), locked = phone();
        String okCode = requestCode(ok), lockedCode = requestCode(locked);
        for (int i = 0; i < 4; i++) assertThat(status(BASE + "verify", "phoneNumber", ok, "code", wrong(okCode, i))).isEqualTo(400);
        assertThat(token(ok, okCode)).hasSizeGreaterThan(30);
        for (int i = 0; i < 5; i++) assertThat(status(BASE + "verify", "phoneNumber", locked, "code", wrong(lockedCode, i))).isEqualTo(400);
        assertThat(status(BASE + "verify", "phoneNumber", locked, "code", lockedCode)).isEqualTo(400);
        assertThat(status(BASE + "verify", "phoneNumber", ok, "code", okCode)).as("a code works once").isEqualTo(400);
    }

    @Test
    @DisplayName("an expired code is refused")
    void expired() throws Exception {
        String p = phone();
        String code = requestCode(p);
        jdbc.update("UPDATE core_schema.phone_otp_codes SET expires_at = now() - interval '1 second' WHERE phone = ?", e164(p));
        assertThat(status(BASE + "verify", "phoneNumber", p, "code", code)).isEqualTo(400);
    }

    @Test
    @DisplayName("the token registers that number once; another number or a second use is refused")
    void tokenAtSignUp() throws Exception {
        String p = phone();
        String t = token(p, requestCode(p));
        String other = phone();
        assertThat(status("/api/v1/auth/register", "fullName", "OTP User", "email", uniq("otpx") + "@validation.example",
            "password", "secret123", "phoneNumber", other, "phoneToken", t)).as("token is for another number").isEqualTo(400);

        String p2 = phone();
        String t2 = token(p2, requestCode(p2));
        String email = uniq("otp") + "@validation.example";
        assertThat(status("/api/v1/auth/register", "fullName", "OTP User", "email", email,
            "password", "secret123", "phoneNumber", p2, "phoneToken", t2)).isEqualTo(201);
        assertThat(jdbc.queryForObject("SELECT phone_number FROM core_schema.users WHERE email = ?", String.class, email)).isEqualTo(p2);
        assertThat(status("/api/v1/auth/register", "fullName", "OTP User", "email", uniq("otp2") + "@validation.example",
            "password", "secret123", "phoneNumber", p2, "phoneToken", t2)).as("used up").isEqualTo(400);
    }

    private static String wrong(String code, int i) {
        String w = String.format("%06d", (Integer.parseInt(code) + 1 + i) % 1_000_000);
        return w.equals(code) ? "000000" : w;
    }
}
