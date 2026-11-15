package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Subscriptions over HTTP: the response shape, what is stored, and what the subscription later means for alerts. */
class AlertSubscriptionFlowApiTest extends FlowTestBase {
    private static final String SUBS = "/api/v1/alerts/subscriptions";

    private Map<String, Object> flags(String subscriptionId) {
        return jdbc.queryForMap("SELECT channel_push, channel_sms, is_active FROM core_schema.alert_subscriptions WHERE subscription_id = CAST(? AS uuid)", subscriptionId);
    }

    @Test
    void subscribeReturnsTheSubscriptionWithAreaNameChannelsInFixedOrderAndTimestamp() throws Exception {
        Acct citizen = account("citizen", "Has phone", "0912345678");
        int area = seedArea("flow-sub", true);

        JsonNode created = read(call(HttpMethod.POST, SUBS, citizen, Map.of("areaId", area, "alertChannels", List.of("SMS", "PUSH"))).andExpect(status().isOk()));

        assertThat(created.get("subscriptionId").asText()).matches("[0-9a-f-]{36}");
        assertThat(created.get("areaId").asInt()).isEqualTo(area);
        assertThat(created.get("areaName").asText()).startsWith("flow-sub");
        assertThat(created.get("alertChannels")).extracting(JsonNode::asText).containsExactly("PUSH", "SMS");
        assertThat(java.time.OffsetDateTime.parse(created.get("subscribedAt").asText())).isNotNull();
        assertThat(flags(created.get("subscriptionId").asText())).containsEntry("channel_push", true).containsEntry("channel_sms", true).containsEntry("is_active", true);
    }

    @Test
    void subscribingAgainKeepsTheSameSubscriptionAndSwitchesChannelsBothWays() throws Exception {
        Acct citizen = account("citizen", "Has phone", "0912345678");
        int area = seedArea();
        String id = read(call(HttpMethod.POST, SUBS, citizen, Map.of("areaId", area, "alertChannels", List.of("PUSH")))).get("subscriptionId").asText();

        JsonNode smsOnly = read(call(HttpMethod.POST, SUBS, citizen, Map.of("areaId", area, "alertChannels", List.of("SMS"))).andExpect(status().isOk()));

        assertThat(smsOnly.get("subscriptionId").asText()).isEqualTo(id);
        assertThat(smsOnly.get("alertChannels")).extracting(JsonNode::asText).containsExactly("SMS");
        assertThat(flags(id)).containsEntry("channel_push", false).containsEntry("channel_sms", true);
        assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", citizen.id())).isEqualTo(1);
    }

    @Test
    void listIsMineOnlyNewestFirstWithoutInactiveRows() throws Exception {
        Acct me = account("citizen");
        Acct other = account("citizen");
        int oldest = seedArea();
        int newest = seedArea();
        int switchedOff = seedArea();
        int othersArea = seedArea();
        for (int a : List.of(oldest, newest, switchedOff)) {
            jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, false)", me.id(), a);
        }
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, false)", other.id(), othersArea);
        jdbc.update("UPDATE core_schema.alert_subscriptions SET subscribed_at = now() - interval '2 days' WHERE user_id = ? AND area_id = ?", me.id(), oldest);
        jdbc.update("UPDATE core_schema.alert_subscriptions SET subscribed_at = now() - interval '1 day' WHERE user_id = ? AND area_id = ?", me.id(), newest);
        jdbc.update("UPDATE core_schema.alert_subscriptions SET is_active = false WHERE user_id = ? AND area_id = ?", me.id(), switchedOff);

        call(HttpMethod.GET, SUBS, me, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].areaId").value(newest))
            .andExpect(jsonPath("$[1].areaId").value(oldest));
        call(HttpMethod.GET, SUBS, other, null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].areaId").value(othersArea));
    }

    @Test
    void smsWithoutAnyPhoneIsRefusedAndStoresNothingWhilePushOnlyNeverNeedsOne() throws Exception {
        Acct noPhone = account("citizen", "No phone", null);
        int area = seedArea();

        call(HttpMethod.POST, SUBS, noPhone, Map.of("areaId", area, "alertChannels", List.of("SMS"))).andExpect(status().isBadRequest());
        assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", noPhone.id())).isZero();

        call(HttpMethod.POST, SUBS, noPhone, Map.of("areaId", area, "alertChannels", List.of("PUSH"))).andExpect(status().isOk());
        assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", noPhone.id())).isEqualTo(1);
    }

    @Test
    void aPhoneGivenWithTheSubscriptionIsSavedToTheProfileAndMakesTheCitizenAnSmsRecipient() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen", "Sms citizen", null);
        int area = seedArea();

        call(HttpMethod.POST, SUBS, citizen, Map.of("areaId", area, "alertChannels", List.of("SMS"), "phoneNumber", "0987654321")).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT phone_number FROM core_schema.users WHERE user_id = ?", String.class, citizen.id())).isEqualTo("0987654321");
        call(HttpMethod.GET, "/api/v1/notifications/broadcast/preview?areaId=" + area, admin, null)
            .andExpect(jsonPath("$.smsSubscribers").value(1)).andExpect(jsonPath("$.subscribers").value(0));
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(status().isOk()).andExpect(jsonPath("$.sms_sent").value(1));
        verify(sms).send(org.mockito.ArgumentMatchers.eq("0987654321"), anyString());
    }

    @Test
    void unsubscribingDeletesTheRowAndTheCitizenIsNoLongerAlerted() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES ('tok-unsub', ?)", citizen.id());
        String id = read(call(HttpMethod.POST, SUBS, citizen, Map.of("areaId", area, "alertChannels", List.of("PUSH")))).get("subscriptionId").asText();

        call(HttpMethod.DELETE, SUBS + "/" + id, citizen, null).andExpect(status().isNoContent());

        assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE subscription_id = CAST(? AS uuid)", id)).isZero();
        call(HttpMethod.GET, SUBS, citizen, null).andExpect(jsonPath("$.length()").value(0));
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(jsonPath("$.status").value("NO_RECIPIENTS"));
        verifyNoInteractions(fcm);
        call(HttpMethod.DELETE, SUBS + "/" + id, citizen, null).andExpect(status().isNotFound());
    }

    @Test
    void anotherCitizensAttemptToUnsubscribeMeLeavesMySubscriptionIntact() throws Exception {
        Acct owner = account("citizen");
        Acct intruder = account("citizen");
        int area = seedArea();
        String id = read(call(HttpMethod.POST, SUBS, owner, Map.of("areaId", area, "alertChannels", List.of("PUSH")))).get("subscriptionId").asText();

        call(HttpMethod.DELETE, SUBS + "/" + id, intruder, null).andExpect(status().isNotFound());

        assertThat(flags(id)).containsEntry("is_active", true);
        call(HttpMethod.GET, SUBS, owner, null).andExpect(jsonPath("$.length()").value(1));
    }
}
