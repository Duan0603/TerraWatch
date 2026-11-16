package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pairwise table of subscribing to an area (PW-SUB-001..009): channel x phone number x area x already subscribed.
 * Order of the checks, as the code runs them: a malformed phone is a 400 first (bean validation, even for a PUSH-only
 * request and even when the area does not exist); then an area that is off or unknown is a 404 (even for SMS without a
 * phone); only then "SMS needs a phone" is a 400. A refused request leaves the existing subscription, the phone on the
 * profile and the row count untouched; an accepted one replaces the channels of the row (see AlertSubscriptionLifecycleApiTest)
 * and saves a phone given with SMS to the profile.
 */
class AlertSubscriptionPairwiseApiTest extends FlowTestBase {
    private static final String SUBS = "/api/v1/alerts/subscriptions";
    private static final int UNKNOWN_AREA = 2_000_000_000;

    @ParameterizedTest(name = "{0}: {1}, phone {2}, area {3}, already subscribed {4} -> {5}")
    @CsvSource({
        "PW-SUB-001, PUSH, none,    active,  false, 200",
        "PW-SUB-002, PUSH, valid,   off,     true,  404",
        "PW-SUB-003, SMS,  none,    unknown, true,  404",
        "PW-SUB-004, SMS,  invalid, off,     false, 400",
        "PW-SUB-005, BOTH, valid,   unknown, false, 404",
        "PW-SUB-006, BOTH, invalid, active,  true,  400",
        "PW-SUB-007, PUSH, invalid, unknown, false, 400",
        "PW-SUB-008, SMS,  valid,   active,  false, 200",
        "PW-SUB-009, BOTH, none,    off,     false, 404"
    })
    void subscribeCombinationFollowsTheOrderOfChecks(String id, String channel, String phone, String area, boolean already,
                                                     int expected) throws Exception {
        Acct citizen = account("citizen", "Pairwise sub", null);
        int target = area.equals("unknown") ? UNKNOWN_AREA : seedArea("pw-sub", !area.equals("off"));
        String existingId = null;
        if (already) {
            // for an unknown target area the earlier subscription is to some other area
            int existingArea = area.equals("unknown") ? seedArea() : target;
            existingId = jdbc.queryForObject("""
                INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms)
                VALUES (?, ?, true, false) RETURNING subscription_id::text""", String.class, citizen.id(), existingArea);
        }
        List<String> channels = channel.equals("BOTH") ? List.of("PUSH", "SMS") : List.of(channel);
        Map<String, Object> body = new java.util.HashMap<>(Map.of("areaId", target, "alertChannels", channels));
        if (phone.equals("valid")) body.put("phoneNumber", "0987654321");
        if (phone.equals("invalid")) body.put("phoneNumber", "12ab");
        long rowsBefore = count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", citizen.id());

        var result = call(HttpMethod.POST, SUBS, citizen, body).andExpect(status().is(expected));

        String savedPhone = jdbc.queryForObject("SELECT phone_number FROM core_schema.users WHERE user_id = ?", String.class, citizen.id());
        if (expected == 200) {
            JsonNode answer = read(result);
            List<String> got = new ArrayList<>();
            answer.get("alertChannels").forEach(c -> got.add(c.asText()));
            assertThat(got).containsExactlyElementsOf(channels);
            assertThat(answer.get("areaId").asInt()).isEqualTo(target);
            assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", citizen.id())).isEqualTo(rowsBefore + 1);
            // a phone given with the SMS channel is kept on the profile, so the next broadcast can reach it
            assertThat(savedPhone).isEqualTo(phone.equals("valid") && channels.contains("SMS") ? "0987654321" : null);
        } else {
            assertThat(count("SELECT count(*) FROM core_schema.alert_subscriptions WHERE user_id = ?", citizen.id())).isEqualTo(rowsBefore);
            assertThat(savedPhone).as("a refused request must not touch the profile phone").isNull();
            if (existingId != null) {
                Map<String, Object> row = jdbc.queryForMap("SELECT channel_push, channel_sms, is_active FROM core_schema.alert_subscriptions WHERE subscription_id = CAST(? AS uuid)", existingId);
                assertThat(row).containsEntry("channel_push", true).containsEntry("channel_sms", false).containsEntry("is_active", true);
            }
        }
        // the list holds what was accepted, plus a subscription made earlier (kept even when its area was switched off since)
        JsonNode mine = read(call(HttpMethod.GET, SUBS, citizen, null).andExpect(status().isOk()));
        boolean listsTarget = false;
        for (JsonNode n : mine) if (n.get("areaId").asInt() == target) listsTarget = true;
        assertThat(listsTarget).isEqualTo(expected == 200 || (already && !area.equals("unknown")));
    }
}
