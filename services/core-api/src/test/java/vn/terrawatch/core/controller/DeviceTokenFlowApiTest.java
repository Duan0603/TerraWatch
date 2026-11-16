package vn.terrawatch.core.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Who owns a registered phone token, and what that means for who gets a push. */
class DeviceTokenFlowApiTest extends FlowTestBase {
    private static final String REGISTER = "/api/v1/alerts/devices/register";
    private static final String DEVICES = "/api/v1/alerts/devices";

    private Map<String, Object> row(String token) {
        return jdbc.queryForMap("SELECT user_id, device_type FROM core_schema.device_tokens WHERE fcm_token = ?", token);
    }

    private void broadcast(Acct admin, int area) throws Exception {
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "high", "areaId", area)).andExpect(status().isOk());
    }

    @Test
    void deviceTypeIsLowerCasedAndDefaultsToAndroid() throws Exception {
        Acct citizen = account("citizen");
        String ios = "tok-" + UUID.randomUUID();
        String none = "tok-" + UUID.randomUUID();

        call(HttpMethod.POST, REGISTER, citizen, Map.of("fcmToken", ios, "deviceType", "IOS")).andExpect(status().isNoContent());
        call(HttpMethod.POST, REGISTER, citizen, Map.of("fcmToken", none)).andExpect(status().isNoContent());

        assertThat(row(ios)).containsEntry("device_type", "ios").containsEntry("user_id", citizen.id());
        assertThat(row(none)).containsEntry("device_type", "android");
    }

    @Test
    void registeringTheSameTokenAgainKeepsOneRowAndTakesTheNewDeviceType() throws Exception {
        Acct citizen = account("citizen");
        String token = "tok-" + UUID.randomUUID();
        call(HttpMethod.POST, REGISTER, citizen, Map.of("fcmToken", token, "deviceType", "android")).andExpect(status().isNoContent());
        jdbc.update("UPDATE core_schema.device_tokens SET registered_at = now() - interval '5 days' WHERE fcm_token = ?", token);

        call(HttpMethod.POST, REGISTER, citizen, Map.of("fcmToken", token, "deviceType", "ios")).andExpect(status().isNoContent());

        assertThat(count("SELECT count(*) FROM core_schema.device_tokens WHERE fcm_token = ?", token)).isEqualTo(1);
        assertThat(row(token)).containsEntry("device_type", "ios");
        assertThat(count("SELECT count(*) FROM core_schema.device_tokens WHERE fcm_token = ? AND registered_at > now() - interval '1 minute'", token))
            .as("registered_at is refreshed").isEqualTo(1);
    }

    @Test
    void aSharedPhoneReceivesTheAlertForItsLatestAccountOnly() throws Exception {
        Acct admin = account("admin");
        Acct previous = account("citizen");
        Acct current = account("citizen");
        int area = seedArea();
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, false)", previous.id(), area);
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, false)", current.id(), area);
        call(HttpMethod.POST, REGISTER, previous, Map.of("fcmToken", "tok-shared")).andExpect(status().isNoContent());
        call(HttpMethod.POST, REGISTER, current, Map.of("fcmToken", "tok-shared")).andExpect(status().isNoContent());

        broadcast(admin, area);

        verify(fcm, times(1)).send(eq("tok-shared"), any());
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE user_id = ?", current.id())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries WHERE user_id = ?", previous.id())).isZero();
        // the phone only alerts the latest account; the previous one still follows the area, so its web/app inbox lists it
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", previous, null).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.length()").value(1));
    }

    @Test
    void unregisterRemovesOnlyTheCallersOwnTokenAndRepeatingItIsHarmless() throws Exception {
        Acct owner = account("citizen");
        Acct stranger = account("citizen");
        String token = "tok-" + UUID.randomUUID();
        call(HttpMethod.POST, REGISTER, owner, Map.of("fcmToken", token)).andExpect(status().isNoContent());

        call(HttpMethod.DELETE, DEVICES, stranger, Map.of("fcmToken", token)).andExpect(status().isNoContent());
        assertThat(row(token)).containsEntry("user_id", owner.id());

        call(HttpMethod.DELETE, DEVICES, owner, Map.of("fcmToken", token)).andExpect(status().isNoContent());
        assertThat(count("SELECT count(*) FROM core_schema.device_tokens WHERE fcm_token = ?", token)).isZero();
        call(HttpMethod.DELETE, DEVICES, owner, Map.of("fcmToken", token)).andExpect(status().isNoContent());
    }

    @Test
    void afterLogoutUnregisterTheSubscribedCitizenIsNotPushedAnymore() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int area = seedArea();
        subscribe(citizen, area, "tok-logout", false);

        call(HttpMethod.DELETE, DEVICES, citizen, Map.of("fcmToken", "tok-logout")).andExpect(status().isNoContent());
        broadcast(admin, area);

        verifyNoInteractions(fcm);
        // no phone is pushed, but the citizen still follows the area, so the order is kept for their web/app inbox
        assertThat(count("SELECT count(*) FROM core_schema.alert_deliveries d JOIN core_schema.alert_broadcasts b USING (broadcast_id) WHERE b.area_id = ?", area))
            .as("no push delivery").isZero();
        verify(fcm, never()).send(any(), any());
    }
}
