package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Alert subscription states (ST-SUB-001..024): none, PUSH, SMS, both, each met with a subscribe, an unsubscribe, an area switched
 * off and an admin broadcast; asserted over HTTP and in the stored rows and the senders, not on service internals.
 * Already covered by older tests and not repeated: 001, 002, 003 (AlertSubscriptionFlowApiTest), 004 (ProfileAndSubscriptionApiTest,
 * unknown id is 404), 005 (MonitoringAreaFlowApiTest, subscribing to an area that is off is 404), 006 (PushAlertsApiTest
 * noRecipientsDoesNotCreateBroadcastRow), 009 (flow test, same row switched to SMS), 010 (flow test, delete is 204),
 * 012 (PushAlertsApiTest), 024 (SmsBroadcastApiTest).
 * Behaviour recorded, where the CSV says "to be verified": a subscribe call REPLACES the channels (PUSH on an SMS subscription
 * drops SMS and the other way round), it never adds a channel; the row is kept (same id, never a duplicate). "SMS without a phone"
 * means no phone in the request and none on the profile.
 * Switching an area off keeps every subscription (still listed) but the area gets no broadcast until it is switched on again.
 */
class AlertSubscriptionLifecycleApiTest extends FlowTestBase {
    private static final String SUBS = "/api/v1/alerts/subscriptions";

    private String seedSubscription(Acct user, int area, boolean push, boolean sms) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms)
            VALUES (?, ?, ?, ?) RETURNING subscription_id::text
            """, String.class, user.id(), area, push, sms);
    }

    private Map<String, Object> flags(String id) {
        return jdbc.queryForMap("SELECT channel_push, channel_sms, is_active FROM core_schema.alert_subscriptions WHERE subscription_id = CAST(? AS uuid)", id);
    }

    private Acct citizenWithPhone(String phone) {
        Acct c = account("citizen", "Sub Citizen", phone);
        jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES (?, ?)", "tok-" + c.id(), c.id());
        return c;
    }

    // ---- ST-SUB-007/008/013/014/015/019/020/021: subscribe calls on an existing subscription ----

    @ParameterizedTest(name = "subscription push={0} sms={1}, request {2} phone {3}: {4}, stored push={5} sms={6} on the same row [{7}]")
    @CsvSource({
        "true,  false, PUSH,     none,  200, true,  false, ST-SUB-007",
        "true,  false, SMS,      none,  400, true,  false, ST-SUB-008",
        "false, true,  PUSH,     none,  200, true,  false, ST-SUB-013",
        "false, true,  SMS,      none,  400, false, true,  ST-SUB-014",
        "false, true,  SMS,      given, 200, false, true,  ST-SUB-015",
        "true,  true,  PUSH,     none,  200, true,  false, ST-SUB-019",
        "true,  true,  SMS,      none,  400, true,  true,  ST-SUB-020",
        "true,  true,  SMS,      given, 200, false, true,  ST-SUB-021"
    })
    void aSubscribeCallOnAnExistingSubscriptionReplacesItsChannelsOnTheSameRow(boolean fromPush, boolean fromSms, String channel, String phone,
                                                                              int expectedStatus, boolean toPush, boolean toSms, String ids) throws Exception {
        Acct citizen = account("citizen", "Existing sub", null);
        int area = seedArea();
        String id = seedSubscription(citizen, area, fromPush, fromSms);
        Map<String, Object> body = phone.equals("given")
            ? Map.of("areaId", area, "alertChannels", List.of(channel), "phoneNumber", "0987654321")
            : Map.of("areaId", area, "alertChannels", List.of(channel));

        var result = call(HttpMethod.POST, SUBS, citizen, body).andExpect(status().is(expectedStatus));

        if (expectedStatus == 200) {
            JsonNode answer = read(result);
            assertThat(answer.get("subscriptionId").asText()).isEqualTo(id);
            List<String> channels = new ArrayList<>();
            answer.get("alertChannels").forEach(c -> channels.add(c.asText()));
            assertThat(channels).containsExactlyElementsOf(toPush && toSms ? List.of("PUSH", "SMS") : toPush ? List.of("PUSH") : List.of("SMS"));
        }
        assertThat(flags(id)).containsEntry("channel_push", toPush).containsEntry("channel_sms", toSms).containsEntry("is_active", true);
        assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", citizen.id())).isEqualTo(1);
        // the phone of the request is saved to the profile only when the call succeeded; a refused call stores nothing
        assertThat(jdbc.queryForObject("SELECT phone_number FROM core_schema.users WHERE user_id = ?", String.class, citizen.id()))
            .isEqualTo(phone.equals("given") ? "0987654321" : null);
    }

    // ---- ST-SUB-016/022: unsubscribing an SMS or a both-channel subscription ----

    @ParameterizedTest(name = "subscription push={0} sms={1} unsubscribed: 204, row gone, no recipient any more [{2}]")
    @CsvSource({"false, true, ST-SUB-016", "true, true, ST-SUB-022"})
    void unsubscribingRemovesTheRowAndStopsEveryChannel(boolean push, boolean smsChannel, String ids) throws Exception {
        Acct admin = account("admin");
        Acct citizen = citizenWithPhone("0912345678");
        int area = seedArea();
        String id = seedSubscription(citizen, area, push, smsChannel);

        call(HttpMethod.DELETE, SUBS + "/" + id, citizen, null).andExpect(status().isNoContent());

        assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE subscription_id = CAST(? AS uuid)", id)).isZero();
        call(HttpMethod.GET, SUBS, citizen, null).andExpect(jsonPath("$.length()").value(0));
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(jsonPath("$.status").value("NO_RECIPIENTS"));
        verifyNoInteractions(fcm, sms);
        // the phone and the device stay on the account: only the subscription went
        assertThat(count("SELECT count(*) FROM core_schema.device_tokens WHERE user_id = ?", citizen.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT phone_number FROM core_schema.users WHERE user_id = ?", String.class, citizen.id())).isEqualTo("0912345678");
    }

    // ---- ST-SUB-011/017/023: the area is switched off while subscribed ----

    @ParameterizedTest(name = "subscription push={0} sms={1}, area switched off: row kept and listed, no broadcast reaches it, back on it does [{2}]")
    @CsvSource({"true, false, ST-SUB-011", "false, true, ST-SUB-017", "true, true, ST-SUB-023"})
    void aSwitchedOffAreaKeepsItsSubscriptionsButGetsNoBroadcastUntilItIsOnAgain(boolean push, boolean smsChannel, String ids) throws Exception {
        Acct admin = account("admin");
        Acct citizen = citizenWithPhone("0912345678");
        int area = seedArea();
        String id = seedSubscription(citizen, area, push, smsChannel);

        call(HttpMethod.PUT, "/api/v1/monitoring-areas/" + area, admin, Map.of("isActive", false)).andExpect(status().isOk());

        assertThat(flags(id)).containsEntry("is_active", true).containsEntry("channel_push", push).containsEntry("channel_sms", smsChannel);
        call(HttpMethod.GET, SUBS, citizen, null).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].subscriptionId").value(id));
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(jsonPath("$.status").value("NO_RECIPIENTS"));
        verifyNoInteractions(fcm, sms);
        assertThat(count("SELECT count(*) FROM core_schema.alert_broadcasts WHERE area_id = ?", area)).isZero();

        call(HttpMethod.PUT, "/api/v1/monitoring-areas/" + area, admin, Map.of("isActive", true)).andExpect(status().isOk());
        em.clear();
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(push ? 1 : 0))
            .andExpect(jsonPath("$.sms_sent").value(smsChannel ? 1 : 0));
    }

    // ---- ST-SUB-018: an SMS-only subscriber ----

    @Test
    void anSmsOnlySubscriberGetsTheSmsAndNoPushEvenWithARegisteredDevice() throws Exception {
        // ST-SUB-018
        Acct admin = account("admin");
        Acct citizen = citizenWithPhone("0912345678");
        int area = seedArea();
        seedSubscription(citizen, area, false, true);

        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sms_sent").value(1))
            .andExpect(jsonPath("$.devices").value(0));

        verify(sms).send(eq("0912345678"), anyString());
        verifyNoInteractions(fcm);
        assertThat(jdbc.queryForList("SELECT channel FROM core_schema.alert_deliveries WHERE user_id = ?", String.class, citizen.id())).containsExactly("sms");
    }
}
