package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Side effects of the admin broadcast routes: audit rows, live-update events, history limits, recipient preview. */
class NotificationAuditApiTest extends FlowTestBase {
    private static final String BROADCAST = "/api/v1/notifications/broadcast";

    private List<Map<String, Object>> auditRows(Acct actor, String action) {
        return jdbc.queryForList("SELECT actor_email, target_type, target_id, target_label, detail FROM core_schema.admin_audit "
            + "WHERE actor_id = ? AND action = ? ORDER BY audit_id", actor.id(), action);
    }

    @Test
    void sendingABroadcastWritesOneAuditRowNamingTheAdminTheBroadcastAndTheOutcome() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        subscribe(account("citizen"), area, "tok-audit-1", false);
        MvcResult stream = openStream();

        JsonNode result = read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area)).andExpect(status().isOk()));

        List<Map<String, Object>> rows = auditRows(admin, "BROADCAST_SEND");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)).containsEntry("actor_email", admin.user().getEmail())
            .containsEntry("target_type", "broadcast")
            .containsEntry("target_id", result.get("broadcast_id").asText())
            .containsEntry("detail", "status=DISPATCHED, area=" + area + ", risk=high");
        assertThat(rows.get(0).get("target_label")).isNull();
        assertThat(updates(stream)).containsExactly("broadcasts");
    }

    @Test
    void aBroadcastWithNobodyToReachIsStillLoggedButHasNoBroadcastId() throws Exception {
        Acct admin = account("admin");
        int emptyArea = seedArea();

        call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "extreme", "areaId", emptyArea))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NO_RECIPIENTS"));

        List<Map<String, Object>> rows = auditRows(admin, "BROADCAST_SEND");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("target_id")).isNull();
        assertThat(rows.get(0).get("detail")).isEqualTo("status=NO_RECIPIENTS, area=" + emptyArea + ", risk=extreme");
        assertThat(count("SELECT count(*) FROM core_schema.alert_broadcasts WHERE area_id = ?", emptyArea)).isZero();
    }

    @Test
    void aRejectedBroadcastLeavesNoAuditRowAndNoLiveEvent() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        MvcResult stream = openStream();

        call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "apocalypse", "areaId", area)).andExpect(status().isBadRequest());

        assertThat(auditRows(admin, "BROADCAST_SEND")).isEmpty();
        assertThat(updates(stream)).isEmpty();
        org.mockito.Mockito.verifyNoInteractions(fcm, sms);
    }

    @Test
    void revokingWritesOneAuditRowAndAnUnknownOrRepeatedRevokeWritesNone() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        subscribe(account("citizen"), area, "tok-audit-2", false);
        MvcResult stream = openStream();
        String id = read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area))).get("broadcast_id").asText();

        call(HttpMethod.POST, BROADCAST + "/" + id + "/revoke", admin, null).andExpect(status().isNoContent());
        call(HttpMethod.POST, BROADCAST + "/" + id + "/revoke", admin, null).andExpect(status().isNotFound());
        call(HttpMethod.POST, BROADCAST + "/" + java.util.UUID.randomUUID() + "/revoke", admin, null).andExpect(status().isNotFound());

        List<Map<String, Object>> rows = auditRows(admin, "BROADCAST_REVOKE");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)).containsEntry("target_type", "broadcast").containsEntry("target_id", id);
        assertThat(rows.get(0).get("detail")).isNull();
        assertThat(updates(stream)).containsExactly("broadcasts", "broadcasts"); // the send and the one real revoke
    }

    @Test
    void auditLogShowsBroadcastActionsNewestFirst() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        subscribe(account("citizen"), area, "tok-audit-3", false);
        String id = read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area))).get("broadcast_id").asText();
        jdbc.update("UPDATE core_schema.admin_audit SET created_at = created_at - interval '1 minute' WHERE actor_id = ?", admin.id());
        call(HttpMethod.POST, BROADCAST + "/" + id + "/revoke", admin, null).andExpect(status().isNoContent());

        call(HttpMethod.GET, "/api/v1/admin/audit?limit=2", admin, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].action").value("BROADCAST_REVOKE"))
            .andExpect(jsonPath("$[0].actor").value(admin.user().getEmail()))
            .andExpect(jsonPath("$[0].targetId").value(id))
            .andExpect(jsonPath("$[1].action").value("BROADCAST_SEND"));
    }

    @Test
    void historyLimitIsClampedToAtLeastOneAndDefaultsToEverythingRecent() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        subscribe(account("citizen"), area, "tok-hist", false);
        String first = read(call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area, "message", "first"))).get("broadcast_id").asText();
        jdbc.update("UPDATE core_schema.alert_broadcasts SET broadcast_time = broadcast_time - interval '1 minute' WHERE broadcast_id = CAST(? AS uuid)", first);
        call(HttpMethod.POST, BROADCAST, admin, Map.of("riskLevel", "high", "areaId", area, "message", "second")).andExpect(status().isOk());

        for (String limit : List.of("0", "-7")) {
            call(HttpMethod.GET, "/api/v1/notifications/broadcasts?limit=" + limit, admin, null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].message").value("second"));
        }
        JsonNode all = read(call(HttpMethod.GET, "/api/v1/notifications/broadcasts?limit=100000", admin, null));
        assertThat(all.size()).isGreaterThanOrEqualTo(2);
        assertThat(all.get(0).get("message").asText()).isEqualTo("second");
        assertThat(all.get(1).get("message").asText()).isEqualTo("first");
    }

    @Test
    void previewCountsOnlyActiveSubscriptionsAndOnlyChannelsThatCanReallyDeliver() throws Exception {
        Acct admin = account("admin");
        int area = seedArea();
        // push + sms, phone on profile: counts as a push subscriber, a device and an sms subscriber
        Acct both = account("citizen", "Both", "0912345678");
        subscribe(both, area, "tok-both", true);
        // push only
        subscribe(account("citizen", "Push", null), area, "tok-push", false);
        // sms asked for but no phone on the profile, push off: reaches nobody
        Acct noPhone = account("citizen", "No phone", null);
        jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES ('tok-nophone', ?)", noPhone.id());
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, false, true)", noPhone.id(), area);
        // unsubscribed (inactive) row: ignored for every channel
        Acct gone = account("citizen", "Gone", "0987654321");
        subscribe(gone, area, "tok-gone", true);
        jdbc.update("UPDATE core_schema.alert_subscriptions SET is_active = false WHERE user_id = ?", gone.id());

        call(HttpMethod.GET, BROADCAST + "/preview?areaId=" + area, admin, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.areaId").value(area))
            .andExpect(jsonPath("$.subscribers").value(2))
            .andExpect(jsonPath("$.devices").value(2))
            .andExpect(jsonPath("$.smsSubscribers").value(1));
    }

    @Test
    void previewOfADeactivatedAreaIsNotFound() throws Exception {
        Acct admin = account("admin");
        int inactive = seedArea("flow-inactive", false);

        call(HttpMethod.GET, BROADCAST + "/preview?areaId=" + inactive, admin, null).andExpect(status().isNotFound());
    }
}
