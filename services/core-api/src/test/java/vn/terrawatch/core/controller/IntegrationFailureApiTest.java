package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import vn.terrawatch.core.service.ForecastRecoveryPoller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * What core-api does above its clients when a dependency fails, answers with garbage or comes back (IF-* rows where core-api is
 * the caller). The clients' own handling (timeouts, 5xx, bad JSON, circuit breaker) is in the client package tests; here
 * the mocked AI client, FCM sender, mailer and Google verifier fail and the stored rows, the senders and the HTTP answer are read.
 * Covered here: IF-BRD-007/008/010/011/012 (SMS provider rejects some numbers, then recovers), IF-FJOB-002/003/004/006 (poller over an AI that throws, then recovers), IF-BRD-002/004/005/006 (a push run where
 * every kind of FCM answer meets), IF-AUTH-002/004/006 (mail server down, then back), IF-AUTH-008/010/011/012 (Google keys unreachable,
 * garbage token, recovery).
 * Not reachable with the shared context, recorded: IF-FJOB-007..012 (core never calls the GIS service in the forecast job flow; its
 * only caller is the admin diagnostic route and GisServiceClient is not a mocked bean, a real call would leave the test JVM).
 */
class IntegrationFailureApiTest extends FlowTestBase {
    @Autowired ForecastRecoveryPoller poller;

    @BeforeEach
    void mailConfigured() {
        when(mailer.configured()).thenReturn(true);
    }

    // ---- IF-FJOB-002/003/004/006: the AI keeps failing, then comes back ----

    private UUID stuckJob() {
        String unit = "IFF_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, unit);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, unit_version, issued_at, valid_from, valid_until, availability,
                model_version, threshold_version, hazard_level, review_status, is_active, job_status, retry_count, created_at, idempotency_key)
            VALUES (?, ?, 'v1', now(), now(), now() + interval '23 hours', 'available', 'm', 't', NULL,
                CAST('pending' AS core_schema.forecast_review_status), TRUE, 'pending', 0, now() - interval '10 minutes', ?)
            """, id, unit, "iff-" + id);
        return id;
    }

    private Map<String, Object> job(UUID id) {
        em.flush();
        return jdbc.queryForMap("SELECT job_status, retry_count, last_error, CAST(probability AS float8) AS probability, hazard_level::text AS hazard FROM core_schema.forecast_runs WHERE run_id = ?", id);
    }

    @Test
    void aJobSurvivesAnAiOutageAcrossPollsAndCompletesWhenTheAiIsBackWithoutARestart() throws Exception {
        UUID id = stuckJob();
        MvcResult stream = openStream();
        when(ai.requestForecast(anyMap())).thenThrow(new IllegalStateException("AI connection refused"));

        poller.pollStuckJobs();

        // the failure stays inside the poller: the job is not lost, not failed, not completed, nothing is announced
        assertThat(job(id)).containsEntry("job_status", "running").containsEntry("retry_count", 1);
        assertThat(job(id).get("probability")).isNull();
        verify(events, never()).publishEvent(anyString(), anyMap());
        assertThat(updates(stream)).isEmpty();

        // the AI is back: the same job is picked up by the next poll and finished
        doReturn(Map.of("availability", "available", "probability", 0.5, "hazard_level", "medium")).when(ai).requestForecast(anyMap());
        poller.pollStuckJobs();

        assertThat(job(id)).containsEntry("job_status", "completed").containsEntry("retry_count", 2).containsEntry("hazard", "medium");
        verify(events, times(1)).publishEvent(eq("HAZARD_FORECAST_READY"), anyMap());
        assertThat(updates(stream)).containsExactly("queue");
    }

    @Test
    void anAiThatNeverAnswersIsTriedThreeTimesThenTheJobIsFailedAndNoLongerPolled() throws Exception {
        UUID id = stuckJob();
        when(ai.requestForecast(anyMap())).thenThrow(new IllegalStateException("AI read timed out"));

        for (int poll = 1; poll <= 5; poll++) poller.pollStuckJobs();

        verify(ai, times(3)).requestForecast(anyMap());
        assertThat(job(id)).containsEntry("job_status", "failed").containsEntry("retry_count", 3).containsEntry("last_error", "Max retries exceeded");
        verify(events, never()).publishEvent(anyString(), anyMap());
        // and a failed job is not offered to anyone as a forecast
        var queue = read(call(HttpMethod.GET, "/api/v1/forecasts/queue", account("officer"), null).andExpect(status().isOk()));
        queue.forEach(n -> assertThat(n.get("runId").asText()).isNotEqualTo(id.toString()));
        var active = read(call(HttpMethod.GET, "/api/v1/forecasts/active", account("citizen"), null).andExpect(status().isOk()));
        active.forEach(n -> assertThat(n.get("runId").asText()).isNotEqualTo(id.toString()));
    }

    // ---- IF-BRD-002/004/005/006: FCM answers differently for each phone of one order ----

    @Test
    void aMixedFcmRunIsPartialWithEachPhoneKeptOrForgottenByItsOwnAnswer() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        Acct a = account("citizen"), b = account("citizen"), c = account("citizen"), d = account("citizen");
        subscribe(a, area, "if-ok", false);
        subscribe(b, area, "if-5xx", false);
        subscribe(c, area, "if-dead", false);
        subscribe(d, area, "if-nomsg", false);
        when(fcm.send(eq("if-5xx"), any())).thenReturn(FcmSender.Result.failed("FCM 503: UNAVAILABLE"));
        when(fcm.send(eq("if-dead"), any())).thenReturn(FcmSender.Result.unregisteredToken("FCM 404: UNREGISTERED"));
        when(fcm.send(eq("if-nomsg"), any())).thenReturn(FcmSender.Result.failed(null)); // a failure that carries no text

        JsonNode answer = read(call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(status().isOk()));

        assertThat(answer.get("status").asText()).isEqualTo("PARTIAL");
        assertThat(answer.get("sent").asInt()).isEqualTo(1);
        assertThat(answer.get("failed").asInt()).isEqualTo(3);
        String id = answer.get("broadcast_id").asText();
        assertThat(jdbc.queryForMap("SELECT successful_deliveries, failed_deliveries, total_recipients FROM core_schema.alert_broadcasts WHERE broadcast_id = CAST(? AS uuid)", id))
            .containsEntry("successful_deliveries", 1).containsEntry("failed_deliveries", 3).containsEntry("total_recipients", 4);
        List<String> rows = jdbc.queryForList("SELECT fcm_token || ':' || status::text FROM core_schema.alert_deliveries WHERE broadcast_id = CAST(? AS uuid) ORDER BY fcm_token", String.class, id);
        assertThat(rows).containsExactly("if-5xx:failed", "if-dead:failed", "if-nomsg:failed", "if-ok:sent");
        // only the phone FCM called dead loses its token
        assertThat(jdbc.queryForList("SELECT fcm_token FROM core_schema.device_tokens WHERE fcm_token LIKE 'if-%' ORDER BY fcm_token", String.class))
            .containsExactly("if-5xx", "if-nomsg", "if-ok");
        // the admin sees the partial result in the history, the failed citizen can still resync the order
        JsonNode item = null;
        for (JsonNode n : read(call(HttpMethod.GET, "/api/v1/notifications/broadcasts?limit=500", admin, null))) if (n.get("broadcastId").asText().equals(id)) item = n;
        assertThat(item.get("sent").asInt()).isEqualTo(1);
        assertThat(item.get("failed").asInt()).isEqualTo(3);
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", b, null).andExpect(status().isOk());
        assertThat(read(call(HttpMethod.GET, "/api/v1/alerts/broadcasts", b, null)).get(0).get("broadcastId").asText()).isEqualTo(id);
    }

    // ---- IF-AUTH-002/004/006: the mail server is down, then back ----

    @Test
    void aMailServerOutageIs503WithTheCodeStoredAndTheNextTryAfterAMinuteDelivers() throws Exception {
        Acct user = account("citizen");
        String email = user.user().getEmail();
        doThrow(new IllegalStateException("smtp connection refused")).when(mailer).sendCode(anyString(), anyString(), anyString(), anyInt());

        call(HttpMethod.POST, "/api/v1/auth/password-reset/email/request", null, Map.of("email", email))
            .andExpect(status().isServiceUnavailable()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message").value("Không gửi được email. Thử lại sau ít phút."));
        assertThat(count("SELECT count(*) FROM core_schema.password_reset_codes WHERE user_id = ?", user.id())).isEqualTo(1);
        // the password is untouched
        call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", email, "password", "secret123")).andExpect(status().isOk());

        // the server is back, but the one-code-per-minute rule still holds: answered "sent", nothing mailed, no second code
        org.mockito.Mockito.reset(mailer);
        when(mailer.configured()).thenReturn(true);
        call(HttpMethod.POST, "/api/v1/auth/password-reset/email/request", null, Map.of("email", email)).andExpect(status().isOk());
        verify(mailer, never()).sendCode(anyString(), anyString(), anyString(), anyInt());
        assertThat(count("SELECT count(*) FROM core_schema.password_reset_codes WHERE user_id = ?", user.id())).isEqualTo(1);

        // a minute later it works again without a restart
        jdbc.update("UPDATE core_schema.password_reset_codes SET created_at = now() - interval '61 seconds' WHERE user_id = ?", user.id());
        call(HttpMethod.POST, "/api/v1/auth/password-reset/email/request", null, Map.of("email", email)).andExpect(status().isOk());
        verify(mailer, times(1)).sendCode(eq(email), anyString(), org.mockito.ArgumentMatchers.matches("\\d{6}"), eq(10));
        assertThat(count("SELECT count(*) FROM core_schema.password_reset_codes WHERE user_id = ?", user.id())).isEqualTo(2);
    }

    // ---- IF-AUTH-008/010/011/012: Google's public keys are unreachable, the token is garbage, Google is back ----

    @Test
    void googleSignInDuringAKeyOutageIs503AndCreatesNoAccountThenWorksWhenTheKeysAreBack() throws Exception {
        String email = "if-google-" + UUID.randomUUID().toString().substring(0, 8) + "@flow.example";
        long before = count("SELECT count(*) FROM core_schema.users");
        when(verifier.verify("tok")).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Cannot verify Google sign-in right now"));

        call(HttpMethod.POST, "/api/v1/auth/google", null, Map.of("idToken", "tok")).andExpect(status().isServiceUnavailable())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message").value("Cannot verify Google sign-in right now"));
        // IF-AUTH-010/011: a token Google's keys do not vouch for is a 401, and also creates nothing
        doThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google sign-in")).when(verifier).verify("tok");
        call(HttpMethod.POST, "/api/v1/auth/google", null, Map.of("idToken", "tok")).andExpect(status().isUnauthorized());
        assertThat(count("SELECT count(*) FROM core_schema.users")).isEqualTo(before);

        doReturn(new FirebaseIdTokenVerifier.GoogleIdentity(email, "Back Online")).when(verifier).verify("tok");
        JsonNode ok = read(call(HttpMethod.POST, "/api/v1/auth/google", null, Map.of("idToken", "tok")).andExpect(status().isOk()));

        assertThat(ok.get("role").asText()).isEqualTo("citizen");
        assertThat(count("SELECT count(*) FROM core_schema.users WHERE email = ?", email)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM core_schema.users")).isEqualTo(before + 1);
    }

    // ---- IF-BRD-007/008/010/011/012: the SMS provider rejects some numbers, then answers normally again ----

    @Test
    void aMixedSmsRunCountsEachNumberAndTheNextOrderSendsNormallyAgain() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        Acct ok = account("citizen", "Sms ok", "0911111111");
        Acct bad = account("citizen", "Sms bad", "0922222222");
        Acct silent = account("citizen", "Sms silent", "0933333333");
        subscribe(ok, area, "if-sms-t1", true);
        subscribe(bad, area, "if-sms-t2", true);
        subscribe(silent, area, "if-sms-t3", true);
        when(sms.send(eq("0922222222"), anyString())).thenReturn(vn.terrawatch.core.client.SmsSender.Result.failed("eSMS 124: sai brandname"));
        when(sms.send(eq("0933333333"), anyString())).thenReturn(vn.terrawatch.core.client.SmsSender.Result.failed(null));

        JsonNode first = read(call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area)).andExpect(status().isOk()));

        // the push channel is unaffected by the SMS provider; the SMS counts are per number
        assertThat(first.get("status").asText()).isEqualTo("DISPATCHED");
        assertThat(first.get("sent").asInt()).isEqualTo(3);
        assertThat(first.get("sms_recipients").asInt()).isEqualTo(3);
        assertThat(first.get("sms_sent").asInt()).isEqualTo(1);
        assertThat(first.get("sms_failed").asInt()).isEqualTo(2);
        String id = first.get("broadcast_id").asText();
        assertThat(jdbc.queryForList("SELECT phone_number || ':' || status::text || ':' || COALESCE(error_message, '-') || ':' || (provider_message_id IS NOT NULL) FROM core_schema.alert_deliveries WHERE channel = 'sms' AND broadcast_id = CAST(? AS uuid) ORDER BY phone_number", String.class, id))
            .containsExactly("0911111111:sent:-:true", "0922222222:failed:eSMS 124: sai brandname:false", "0933333333:failed:-:false");
        assertThat(jdbc.queryForMap("SELECT total_sms_recipients, successful_sms, failed_sms FROM core_schema.alert_broadcasts WHERE broadcast_id = CAST(? AS uuid)", id))
            .containsEntry("total_sms_recipients", 3).containsEntry("successful_sms", 1).containsEntry("failed_sms", 2);
        // a failed SMS is not retried inside the order
        verify(sms, times(1)).send(eq("0922222222"), anyString());

        // IF-BRD-012: the provider recovers, the next order reaches every number, nothing restarted
        org.mockito.Mockito.reset(sms);
        when(sms.send(anyString(), anyString())).thenReturn(vn.terrawatch.core.client.SmsSender.Result.sent("SID-OK"));
        JsonNode second = read(call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area, "eventId", "IF-SMS-BACK")).andExpect(status().isOk()));
        assertThat(second.get("sms_sent").asInt()).isEqualTo(3);
        assertThat(second.get("sms_failed").asInt()).isZero();
    }
}
