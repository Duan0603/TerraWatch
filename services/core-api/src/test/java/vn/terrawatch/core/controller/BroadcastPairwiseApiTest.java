package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import vn.terrawatch.core.client.FcmSender;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pairwise table of the admin broadcast (PW-BRD-001..016): channel x incident phase x risk level x cited forecast x
 * recipients x message length, asserted over HTTP, in the stored order and delivery rows and in the senders.
 * What the table says and what the code does:
 * - a cited forecast that is pending or expired is a 409 before anything else, even with no recipients (as the CSV says);
 * - no recipient on the chosen channel: 200 NO_RECIPIENTS and no order row (as the CSV says);
 * - 161 characters: the CSV says "blocked"; the API accepts up to 1000 and only the web form stops at 160 (BL-BRD-004,
 *   BroadcastBoundaryApiTest), so the 161 rows record the real behaviour: dispatched with the message unchanged.
 * - the channel of a row is the channel the subscribers chose (push, sms or both); SMS goes only to subscribers with a phone.
 */
class BroadcastPairwiseApiTest extends FlowTestBase {
    private static final String BROADCAST = "/api/v1/notifications/broadcast";

    private static final Map<String, String> SMS_PREFIX = Map.of(
        "pre_incident", "[TERRAWATCH-CANH BAO SOM]",
        "during_incident", "[TERRAWATCH-KHAN CAP]",
        "post_incident", "[TERRAWATCH-BAO AN]");

    private UUID forecast(String kind) {
        String unit = "PWB_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, unit);
        UUID id = UUID.randomUUID();
        String review = kind.equals("pending") ? "pending" : "approved";
        String validUntil = kind.equals("expired") ? "-6 hours" : "10 hours";
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active)
            VALUES (?, ?, now() - interval '12 hours', now() - interval '12 hours', now() + CAST(? AS interval), 'available', 0.8, 'high',
                'm', 't', CAST(? AS core_schema.forecast_review_status), TRUE)
            """, id, unit, validUntil, review);
        return id;
    }

    @ParameterizedTest(name = "{0}: {1}, {2}, {3}, forecast {4}, {5} recipients, {6} characters")
    @CsvSource({
        "PW-BRD-001, PUSH, pre_incident,    low,     none,     0, 1",
        "PW-BRD-002, PUSH, during_incident, medium,  approved, 1, 160",
        "PW-BRD-003, PUSH, post_incident,   high,    pending,  3, 161",
        "PW-BRD-004, SMS,  pre_incident,    extreme, none,     1, 161",
        "PW-BRD-005, BOTH, during_incident, extreme, approved, 3, 1",
        "PW-BRD-006, SMS,  during_incident, low,     expired,  0, 160",
        "PW-BRD-007, BOTH, pre_incident,    medium,  none,     3, 160",
        "PW-BRD-008, BOTH, post_incident,   low,     approved, 0, 161",
        "PW-BRD-009, SMS,  post_incident,   medium,  pending,  1, 1",
        "PW-BRD-010, SMS,  pre_incident,    high,    approved, 0, 1",
        "PW-BRD-011, BOTH, during_incident, high,    none,     1, 160",
        "PW-BRD-012, PUSH, post_incident,   extreme, none,     0, 160",
        "PW-BRD-013, BOTH, pre_incident,    medium,  expired,  0, 161",
        "PW-BRD-014, SMS,  during_incident, low,     none,     3, 161",
        "PW-BRD-015, PUSH, pre_incident,    low,     none,     1, 1",
        "PW-BRD-016, PUSH, pre_incident,    extreme, pending,  0, 1"
    })
    void broadcastCombinationFollowsTheRulesOfEveryDimension(String id, String channel, String phase, String level, String forecast,
                                                             int recipients, int length) throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        boolean push = !channel.equals("SMS");
        boolean smsChannel = !channel.equals("PUSH");
        for (int i = 0; i < recipients; i++) {
            Acct citizen = account("citizen", "Pairwise " + i, "09123450" + i + "0");
            jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES (?, ?)", "pw-" + UUID.randomUUID(), citizen.id());
            jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, ?, ?)",
                citizen.id(), area, push, smsChannel);
        }
        String message = "m".repeat(length);
        Map<String, Object> body = new HashMap<>(Map.of("riskLevel", level, "areaId", area, "incidentPhase", phase, "message", message));
        UUID run = null;
        if (!forecast.equals("none")) {
            run = forecast(forecast);
            body.put("runId", run.toString());
        }
        long ordersBefore = count("SELECT count(*) FROM core_schema.alert_broadcasts WHERE area_id = ?", area);

        var result = call(HttpMethod.POST, BROADCAST, admin, body);

        int expectedPush = push ? recipients : 0;
        int expectedSms = smsChannel ? recipients : 0;
        if (forecast.equals("pending") || forecast.equals("expired")) {
            result.andExpect(status().isConflict());
            assertThat(count("SELECT count(*) FROM core_schema.alert_broadcasts WHERE area_id = ?", area)).isEqualTo(ordersBefore);
            verifyNoInteractions(fcm, sms);
            return;
        }
        JsonNode answer = read(result.andExpect(status().isOk()));
        if (recipients == 0) {
            assertThat(answer.get("status").asText()).isEqualTo("NO_RECIPIENTS");
            assertThat(answer.get("recipients_estimated").asInt()).isZero();
            assertThat(count("SELECT count(*) FROM core_schema.alert_broadcasts WHERE area_id = ?", area)).isEqualTo(ordersBefore);
            verifyNoInteractions(fcm, sms);
            return;
        }
        // dispatched: the stored order
        Map<String, Object> order = jdbc.queryForMap("""
            SELECT broadcast_id::text AS id, message, severity::text AS severity, incident_phase, run_id, total_recipients,
                   successful_deliveries, failed_deliveries, total_sms_recipients, successful_sms,
                   EXTRACT(EPOCH FROM (valid_until - now())) / 3600 AS hours
            FROM core_schema.alert_broadcasts WHERE area_id = ?""", area);
        assertThat(order.get("message")).isEqualTo(message);
        assertThat(order.get("severity")).isEqualTo(level);
        assertThat(order.get("incident_phase")).isEqualTo(phase);
        assertThat(order.get("total_recipients")).isEqualTo(expectedPush);
        assertThat(order.get("successful_deliveries")).isEqualTo(expectedPush);
        assertThat(order.get("failed_deliveries")).isEqualTo(0);
        assertThat(order.get("total_sms_recipients")).isEqualTo(expectedSms);
        assertThat(order.get("successful_sms")).isEqualTo(expectedSms);
        if (run == null) {
            assertThat(order.get("run_id")).isNull();
            assertThat(((Number) order.get("hours")).doubleValue()).isBetween(23.98, 24.02);
        } else {
            assertThat(order.get("run_id")).isEqualTo(run);
            assertThat(((Number) order.get("hours")).doubleValue()).isBetween(9.98, 10.02); // validity follows the forecast
        }
        // the response
        assertThat(answer.get("sent").asInt()).isEqualTo(expectedPush);
        assertThat(answer.get("failed").asInt()).isZero();
        assertThat(answer.get("sms_recipients").asInt()).isEqualTo(expectedSms);
        assertThat(answer.get("sms_sent").asInt()).isEqualTo(expectedSms);
        assertThat(answer.get("status").asText()).isEqualTo("DISPATCHED");
        assertThat(answer.get("channels").size()).isEqualTo(smsChannel ? 2 : 1);
        // the delivery rows and the senders: each channel only reaches the subscribers who chose it
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE broadcast_id = CAST(? AS uuid) AND channel = 'app_push'", order.get("id")))
            .isEqualTo(expectedPush);
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE broadcast_id = CAST(? AS uuid) AND channel = 'sms'", order.get("id")))
            .isEqualTo(expectedSms);
        ArgumentCaptor<FcmSender.Message> pushed = ArgumentCaptor.forClass(FcmSender.Message.class);
        verify(fcm, times(expectedPush)).send(anyString(), pushed.capture());
        pushed.getAllValues().forEach(m -> {
            assertThat(m.body()).isEqualTo(message);
            assertThat(m.data()).containsEntry("severity", level).containsEntry("type", "EMERGENCY_ALERT");
        });
        ArgumentCaptor<String> texts = ArgumentCaptor.forClass(String.class);
        verify(sms, times(expectedSms)).send(anyString(), texts.capture());
        texts.getAllValues().forEach(t -> assertThat(t).startsWith(SMS_PREFIX.get(phase)).hasSizeLessThanOrEqualTo(160));
        if (expectedSms == 0) verifyNoInteractions(sms);
        if (expectedPush == 0) verifyNoInteractions(fcm);
    }
}
