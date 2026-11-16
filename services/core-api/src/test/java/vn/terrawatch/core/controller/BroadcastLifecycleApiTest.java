package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.SmsSender;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Broadcast order lifecycle (ST-BRD-001..018) and per-recipient delivery status (ST-BRD-019..038), asserted over HTTP and in
 * the stored rows, not on NotificationService internals. Cases older tests already assert are not repeated: 001, 003, 009,
 * 013, 019, 020 (PushAlertsApiTest), 022, 023 (SmsBroadcastApiTest). The ST-BRD-024/026/027/028/034/037 cells are covered by the
 * tests near the end. 025, 035, 036, 038 (a final row meeting a later FCM unregistered, temporary FCM error or SMS failure) are the two tests before the helper. No code path sets a delivery to 'delivered', so 029-033 are unreachable over the API.
 */
class BroadcastLifecycleApiTest extends FlowTestBase {
    private static final String BROADCAST = "/api/v1/notifications/broadcast";

    private String sendTo(Acct admin, int area) throws Exception {
        return read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area)).andExpect(status().isOk()))
            .get("broadcast_id").asText();
    }

    private JsonNode historyItem(Acct admin, String id) throws Exception {
        for (JsonNode n : read(call(HttpMethod.GET, "/api/v1/notifications/broadcasts?limit=500", admin, null).andExpect(status().isOk()))) {
            if (n.get("broadcastId").asText().equals(id)) return n;
        }
        throw new AssertionError("broadcast " + id + " not in history");
    }

    private JsonNode resync(Acct citizen, String id) throws Exception {
        for (JsonNode n : read(call(HttpMethod.GET, "/api/v1/alerts/broadcasts", citizen, null).andExpect(status().isOk()))) {
            if (n.get("broadcastId").asText().equals(id)) return n;
        }
        throw new AssertionError("broadcast " + id + " not in resync");
    }

    private void expire(String id) {
        jdbc.update("UPDATE core_schema.alert_broadcasts SET valid_until = now() - interval '1 minute' WHERE broadcast_id = CAST(? AS uuid)", id);
    }

    // ---- ST-BRD-002/004/008/010/014/016: what the admin sees in history and per-recipient results, per order state ----

    @ParameterizedTest(name = "order {0}: history shows status={1} and deliveries stay readable [{2}]")
    @CsvSource({
        "active,  active,  ST-BRD-002/004",
        "expired, active,  ST-BRD-008/010",
        "revoked, revoked, ST-BRD-014/016"
    })
    void adminSeesTheOrderAndItsDeliveriesInEveryState(String state, String historyStatus, String ids) throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen", "Delivery Reader", null);
        int area = seedArea();
        subscribe(citizen, area, "tok-" + state, false);
        String id = sendTo(admin, area);
        if (state.equals("expired")) expire(id);
        if (state.equals("revoked")) call(HttpMethod.POST, BROADCAST + "/" + id + "/revoke", admin, null).andExpect(status().isNoContent());

        JsonNode item = historyItem(admin, id);
        assertThat(item.get("status").asText()).isEqualTo(historyStatus);
        assertThat(item.get("recipients").asInt()).isEqualTo(1);
        assertThat(item.get("sent").asInt()).isEqualTo(1);
        assertThat(item.get("revokedAt").isNull()).isEqualTo(!state.equals("revoked"));
        // expiry is not a stored status: an expired order is told apart by validUntil alone
        assertThat(item.get("validUntil").asText().compareTo(java.time.Instant.now().toString()) < 0).isEqualTo(state.equals("expired"));

        JsonNode deliveries = read(call(HttpMethod.GET, BROADCAST + "/" + id + "/deliveries", admin, null).andExpect(status().isOk()));
        assertThat(deliveries).hasSize(1);
        assertThat(deliveries.get(0).get("status").asText()).isEqualTo("sent");
        assertThat(deliveries.get(0).get("recipientName").asText()).isEqualTo("Delivery Reader");
    }

    // ---- ST-BRD-007: revoking an order whose 24 hours are over ----

    @Test
    void anOrderThatAlreadyExpiredCanStillBeRevokedAndThenReadsRevoked() throws Exception {
        // ST-BRD-007 (behaviour recorded: revoke only checks "not yet revoked", not the validity window)
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-exp-revoke", false);
        String id = sendTo(admin, area);
        expire(id);
        MvcResult stream = openStream();

        call(HttpMethod.POST, BROADCAST + "/" + id + "/revoke", admin, null).andExpect(status().isNoContent());

        JsonNode seen = resync(citizen, id);
        assertThat(seen.get("status").asText()).isEqualTo("revoked");
        assertThat(seen.get("expired").asBoolean()).isTrue();
        assertThat(count("SELECT count(*) FROM core_schema.admin_audit WHERE action = 'BROADCAST_REVOKE' AND target_id = ?", id)).isEqualTo(1);
        assertThat(updates(stream)).containsExactly("broadcasts");
    }

    // ---- ST-BRD-015/018: a revoked order stays revoked for the phone, also after the push or a later sync ----

    @Test
    void aRevokedOrderIsStillRevokedAfterItIsExpiredAndOnEveryLaterSync() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-revoked-sync", false);
        String id = sendTo(admin, area);
        call(HttpMethod.POST, BROADCAST + "/" + id + "/revoke", admin, null).andExpect(status().isNoContent());

        for (int i = 0; i < 2; i++) {
            assertThat(resync(citizen, id).get("status").asText()).isEqualTo("revoked");
        }
        expire(id);
        JsonNode later = resync(citizen, id);
        assertThat(later.get("status").asText()).isEqualTo("revoked");
        assertThat(later.get("expired").asBoolean()).isTrue();
        // a later broadcast to the same area does not bring the revoked one back to "active"
        sendToWithEvent(admin, area, "EVT-after-revoke");
        assertThat(resync(citizen, id).get("status").asText()).isEqualTo("revoked");
    }

    private String sendToWithEvent(Acct admin, int area, String eventId) throws Exception {
        return read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area, "eventId", eventId))
            .andExpect(status().isOk())).get("broadcast_id").asText();
    }

    // ---- ST-BRD-021: temporary FCM failure ----

    @Test
    void aTemporaryFcmErrorIsStoredAsFailedWithItsMessageAndTheTokenIsKept() throws Exception {
        when(fcm.send(eq("tok-temp"), any())).thenReturn(FcmSender.Result.failed("FCM 503: UNAVAILABLE"));
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-temp", false);

        JsonNode result = read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area)).andExpect(status().isOk()));

        assertThat(result.get("status").asText()).isEqualTo("FAILED");
        assertThat(result.get("first_error").asText()).isEqualTo("FCM 503: UNAVAILABLE");
        Map<String, Object> delivery = jdbc.queryForMap("SELECT status::text AS status, error_message, channel FROM core_schema.alert_deliveries WHERE fcm_token = 'tok-temp'");
        assertThat(delivery).containsEntry("status", "failed").containsEntry("error_message", "FCM 503: UNAVAILABLE").containsEntry("channel", "app_push");
        // unlike an unregistered token, a temporary failure keeps the token for the next order
        assertThat(count("SELECT count(*) FROM core_schema.device_tokens WHERE fcm_token = 'tok-temp'")).isEqualTo(1);
    }

    // ---- ST-BRD-024..028, 034..038: a delivery row is written once; a later order never rewrites it ----

    @Test
    void aLaterOrderWritesNewDeliveryRowsAndNeverChangesTheOutcomeOfAnEarlierOne() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen", "Two Orders", "0912345678");
        int area = seedArea();
        subscribe(citizen, area, "tok-two", true);
        // first order: push and SMS both go out
        String first = sendTo(admin, area);
        // second order: both channels fail
        when(fcm.send(eq("tok-two"), any())).thenReturn(FcmSender.Result.failed("FCM 500"));
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.failed("SMS provider down"));
        String second = sendToWithEvent(admin, area, "EVT-second-fails");
        // third order: both succeed again
        when(fcm.send(eq("tok-two"), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.sent("SID-3"));
        String third = sendToWithEvent(admin, area, "EVT-third-ok");

        // ST-BRD-024/027/028 (sent + a later failure) and ST-BRD-034/037 (failed + a later success): rows are independent
        assertThat(outcomes(first)).containsExactly("app_push:sent", "sms:sent");
        assertThat(outcomes(second)).containsExactly("app_push:failed", "sms:failed");
        assertThat(outcomes(third)).containsExactly("app_push:sent", "sms:sent");
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE user_id = ?", citizen.id())).isEqualTo(6);
        // the admin sees the same per-order outcome, so nothing was merged across orders
        assertThat(historyItem(admin, first).get("sent").asInt()).isEqualTo(1);
        assertThat(historyItem(admin, first).get("failed").asInt()).isZero();
        assertThat(historyItem(admin, second).get("sent").asInt()).isZero();
        assertThat(historyItem(admin, second).get("failed").asInt()).isEqualTo(1);
    }

    // ---- ST-BRD-025/035/036/038: a delivery row already 'sent' or 'failed' never changes; a later event only adds rows ----

    @ParameterizedTest(name = "push row {0}, then a later order meets {1}: old row unchanged, new row {2}, token kept={3} [{4}]")
    @CsvSource({
        "sent,   unregistered, failed, false, ST-BRD-025",
        "failed, unregistered, failed, false, ST-BRD-035",
        "failed, temporary,    failed, true,  ST-BRD-036"
    })
    void aPushRowThatIsAlreadyFinalKeepsItsOutcomeWhenALaterOrderMeetsAnFcmError(String first, String event, String second,
                                                                                boolean tokenKept, String ids) throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        String token = "tok-final-" + first + "-" + event;
        subscribe(citizen, area, token, false);
        when(fcm.send(eq(token), any())).thenReturn(first.equals("sent") ? FcmSender.Result.sent() : FcmSender.Result.failed("FCM 503: UNAVAILABLE"));
        String order1 = sendTo(admin, area);
        when(fcm.send(eq(token), any())).thenReturn(event.equals("unregistered")
            ? FcmSender.Result.unregisteredToken("FCM 404: UNREGISTERED") : FcmSender.Result.failed("FCM 500: INTERNAL"));
        String order2 = sendToWithEvent(admin, area, "EVT-" + ids);

        assertThat(outcomes(order1)).containsExactly("app_push:" + first);
        assertThat(outcomes(order2)).containsExactly("app_push:" + second);
        assertThat(jdbc.queryForObject("SELECT error_message FROM core_schema.alert_deliveries WHERE broadcast_id = CAST(? AS uuid)", String.class, order1))
            .isEqualTo(first.equals("sent") ? null : "FCM 503: UNAVAILABLE");
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE fcm_token = ?", token)).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM core_schema.device_tokens WHERE fcm_token = ?", token)).isEqualTo(tokenKept ? 1 : 0);
        // the admin still reads the first order's own result from the stored rows
        assertThat(read(call(HttpMethod.GET, BROADCAST + "/" + order1 + "/deliveries", admin, null).andExpect(status().isOk())).get(0)
            .get("status").asText()).isEqualTo(first);
    }

    @Test
    void anSmsRowThatAlreadyFailedKeepsItsOutcomeWhenALaterOrderFailsAgain() throws Exception {
        // ST-BRD-038 (failed + SMS provider error): the earlier failed row is not touched and the new order gets its own failed row
        Acct admin = account("admin");
        Acct citizen = account("citizen", "Sms Twice", "0912345678");
        int area = seedArea();
        subscribe(citizen, area, "tok-sms-twice", true);
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.failed("SMS provider down"));
        String order1 = sendTo(admin, area);
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.failed("SMS provider 500"));
        String order2 = sendToWithEvent(admin, area, "EVT-sms-twice");

        assertThat(jdbc.queryForList("SELECT error_message FROM core_schema.alert_deliveries WHERE channel = 'sms' AND broadcast_id = CAST(? AS uuid)",
            String.class, order1)).containsExactly("SMS provider down");
        assertThat(jdbc.queryForList("SELECT error_message FROM core_schema.alert_deliveries WHERE channel = 'sms' AND broadcast_id = CAST(? AS uuid)",
            String.class, order2)).containsExactly("SMS provider 500");
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE user_id = ? AND channel = 'sms' AND status = 'failed'", citizen.id())).isEqualTo(2);
    }

    private List<String> outcomes(String broadcastId) {
        return jdbc.queryForList("SELECT channel || ':' || status::text FROM core_schema.alert_deliveries "
            + "WHERE broadcast_id = CAST(? AS uuid) ORDER BY channel", String.class, broadcastId);
    }
}
