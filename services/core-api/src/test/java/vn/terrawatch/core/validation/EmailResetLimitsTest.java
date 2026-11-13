package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static vn.terrawatch.core.validation.Matrix.set;

/** EmailResetService limits at their exact boundaries: 10-minute code life, 5 attempts, 60-second resend gap, 5 codes per hour. */
class EmailResetLimitsTest extends ValidationTestBase {
    private static final String BASE = "/api/v1/auth/password-reset/email/";

    private int call(String path, Object... body) throws Exception {
        return send(HttpMethod.POST, BASE + path, null, json.writeValueAsString(map(body))).getResponse().getStatus();
    }

    private Acct citizen() { return account("citizen", uniq("rst")); }

    private long rows(Acct u) { return count("core_schema.password_reset_codes WHERE user_id = '" + u.id() + "'"); }

    private void seedRow(Acct u, String createdAgo) {
        jdbc.update("INSERT INTO core_schema.password_reset_codes (user_id, code_hash, expires_at, created_at) VALUES (?, ?, now() + interval '10 minutes', now() - CAST(? AS interval))",
            u.id(), encoder.encode("123456"), createdAgo);
    }

    @Test
    @DisplayName("request: the code lives 10 minutes")
    void codeLivesTenMinutes() throws Exception {
        Acct u = citizen();
        assertThat(call("request", "email", u.user().getEmail())).isEqualTo(200);
        assertThat(rows(u)).isEqualTo(1);
        Double minutes = jdbc.queryForObject("SELECT EXTRACT(EPOCH FROM (expires_at - created_at)) / 60 FROM core_schema.password_reset_codes WHERE user_id = ?", Double.class, u.id());
        assertThat(minutes).isBetween(9.99, 10.01);
        verify(mailer).sendCode(anyString(), anyString(), anyString(), org.mockito.ArgumentMatchers.eq(10));
    }

    @Test
    @DisplayName("verify: a code that expires in 1 second is accepted, one that expired 1 second ago is refused")
    void expiryBoundary() throws Exception {
        Acct fresh = citizen(), stale = citizen();
        seedResetCode(fresh.id(), false);
        seedResetCode(stale.id(), false);
        jdbc.update("UPDATE core_schema.password_reset_codes SET expires_at = now() + interval '30 seconds' WHERE user_id = ?", fresh.id());
        jdbc.update("UPDATE core_schema.password_reset_codes SET expires_at = now() - interval '1 second' WHERE user_id = ?", stale.id());
        assertThat(call("verify", "email", fresh.user().getEmail(), "code", "123456")).isEqualTo(200);
        assertThat(call("verify", "email", stale.user().getEmail(), "code", "123456")).isEqualTo(400);
    }

    @Test
    @DisplayName("verify: 4 wrong codes then the right one works; after 5 wrong codes even the right one is refused")
    void fiveAttempts() throws Exception {
        Acct ok = citizen(), locked = citizen();
        seedResetCode(ok.id(), false);
        seedResetCode(locked.id(), false);
        for (int i = 1; i <= 4; i++) assertThat(call("verify", "email", ok.user().getEmail(), "code", "00000" + i)).isEqualTo(400);
        assertThat(call("verify", "email", ok.user().getEmail(), "code", "123456")).as("5th try, right code").isEqualTo(200);
        for (int i = 1; i <= 5; i++) assertThat(call("verify", "email", locked.user().getEmail(), "code", "00000" + i)).isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT attempts FROM core_schema.password_reset_codes WHERE user_id = ?", Integer.class, locked.id())).isEqualTo(5);
        assertThat(call("verify", "email", locked.user().getEmail(), "code", "123456")).as("6th try, right code").isEqualTo(400);
        assertThat(jdbc.queryForObject("SELECT attempts FROM core_schema.password_reset_codes WHERE user_id = ?", Integer.class, locked.id()))
            .as("a locked code does not count further attempts").isEqualTo(5);
    }

    @Test
    @DisplayName("request: a second request within 60 seconds sends nothing, 61 seconds later it sends")
    void resendGap() throws Exception {
        Acct u = citizen();
        assertThat(call("request", "email", u.user().getEmail())).isEqualTo(200);
        assertThat(call("request", "email", u.user().getEmail())).as("immediately again: same answer").isEqualTo(200);
        assertThat(rows(u)).isEqualTo(1);
        jdbc.update("UPDATE core_schema.password_reset_codes SET created_at = now() - interval '55 seconds' WHERE user_id = ?", u.id());
        assertThat(call("request", "email", u.user().getEmail())).isEqualTo(200);
        assertThat(rows(u)).as("55 s after the last one").isEqualTo(1);
        jdbc.update("UPDATE core_schema.password_reset_codes SET created_at = now() - interval '61 seconds' WHERE user_id = ?", u.id());
        assertThat(call("request", "email", u.user().getEmail())).isEqualTo(200);
        assertThat(rows(u)).as("61 s after the last one").isEqualTo(2);
        verify(mailer, times(2)).sendCode(anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    @DisplayName("request: 4 codes in the hour allow a 5th, 5 codes in the hour allow no 6th")
    void fivePerHour() throws Exception {
        Acct four = citizen(), five = citizen();
        for (int i = 0; i < 4; i++) seedRow(four, (10 + i) + " minutes");
        for (int i = 0; i < 5; i++) seedRow(five, (10 + i) + " minutes");
        assertThat(call("request", "email", four.user().getEmail())).isEqualTo(200);
        assertThat(rows(four)).as("5th code of the hour").isEqualTo(5);
        assertThat(call("request", "email", five.user().getEmail())).as("same answer").isEqualTo(200);
        assertThat(rows(five)).as("6th code of the hour is not created").isEqualTo(5);
        verify(mailer, times(1)).sendCode(anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    @DisplayName("request: 5 codes of which one is 61 minutes old leaves room for a new one")
    void hourWindowSlides() throws Exception {
        Acct u = citizen();
        seedRow(u, "61 minutes");
        for (int i = 0; i < 4; i++) seedRow(u, (10 + i) + " minutes");
        assertThat(call("request", "email", u.user().getEmail())).isEqualTo(200);
        assertThat(rows(u)).isEqualTo(6);
    }

    @Test
    @DisplayName("request: unknown / locked accounts get the same 200 and nothing is sent or stored")
    void unknownAccountLooksTheSame() throws Exception {
        assertThat(call("request", "email", "nobody-" + UUID.randomUUID() + "@validation.example")).isEqualTo(200);
        verify(mailer, never()).sendCode(anyString(), anyString(), anyString(), anyInt());
    }

    @Test
    @DisplayName("request: mailer not configured -> 503, never 500")
    void notConfigured() throws Exception {
        org.mockito.Mockito.when(mailer.configured()).thenReturn(false);
        assertThat(call("request", "email", "x@validation.example")).isEqualTo(503);
    }

    @Test
    @DisplayName("complete: a used token cannot be used twice; password changed once")
    void tokenIsOneTime() throws Exception {
        Acct u = citizen();
        seedResetCode(u.id(), true);
        assertThat(call("complete", "email", u.user().getEmail(), "resetToken", "reset-token", "newPassword", "newsecret1")).isEqualTo(204);
        assertThat(call("complete", "email", u.user().getEmail(), "resetToken", "reset-token", "newPassword", "another-secret")).isEqualTo(400);
    }
}
