package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.FcmSender;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class PushAlertsApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;

    private ResultActions call(HttpMethod method, String path, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }

    private String register(String email) throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "Push Test", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private String admin() throws Exception {
        register("admin@push-test.example");
        jdbc.update("UPDATE core_schema.users SET role = CAST('admin' AS core_schema.user_role) WHERE email = 'admin@push-test.example'");
        entityManager.clear(); // the JDBC update bypasses the JPA cache the login would otherwise read
        String body = call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "admin@push-test.example", "password", "secret123"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    /** A citizen with a registered phone and (optionally) a subscription. */
    private String citizen(String email, String fcmToken, Integer areaId, List<String> channels) throws Exception {
        String token = register(email);
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", token, Map.of("fcmToken", fcmToken, "deviceType", "android"))
            .andExpect(status().isNoContent());
        if (areaId != null) {
            call(HttpMethod.POST, "/api/v1/alerts/subscriptions", token, Map.of("areaId", areaId, "alertChannels", channels, "phoneNumber", "0912345678"))
                .andExpect(status().isOk());
        }
        return token;
    }

    private JsonNode broadcast(String adminToken, Map<String, Object> body) throws Exception {
        return json.readTree(call(HttpMethod.POST, "/api/v1/notifications/broadcast", adminToken, body)
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private int owners(String fcmToken) {
        return jdbc.queryForObject("SELECT count(*) FROM core_schema.device_tokens WHERE fcm_token = ?", Integer.class, fcmToken);
    }

    @Test
    void deviceTokenBelongsToTheLastAccountThatRegisteredIt() throws Exception {
        String a = register("a@push-test.example");
        String b = register("b@push-test.example");
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", a, Map.of("fcmToken", "phone-1")).andExpect(status().isNoContent());
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", b, Map.of("fcmToken", "phone-1", "deviceType", "ANDROID")).andExpect(status().isNoContent());
        assertEquals(1, owners("phone-1"));
        assertEquals("b@push-test.example", jdbc.queryForObject(
            "SELECT u.email FROM core_schema.device_tokens t JOIN core_schema.users u USING (user_id) WHERE t.fcm_token = 'phone-1'", String.class));

        call(HttpMethod.DELETE, "/api/v1/alerts/devices", a, Map.of("fcmToken", "phone-1")).andExpect(status().isNoContent());
        assertEquals(1, owners("phone-1"), "an account cannot remove another account's phone");
        call(HttpMethod.DELETE, "/api/v1/alerts/devices", b, Map.of("fcmToken", "phone-1")).andExpect(status().isNoContent());
        assertEquals(0, owners("phone-1"));
    }

    @Test
    void deviceRegistrationValidatesInputAndNeedsASession() throws Exception {
        String a = register("a2@push-test.example");
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", a, Map.of("fcmToken", "  ")).andExpect(status().isBadRequest());
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", a, Map.of("fcmToken", "x".repeat(4097))).andExpect(status().isBadRequest());
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", a, Map.of("fcmToken", "ok", "deviceType", "toaster")).andExpect(status().isBadRequest());
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", null, Map.of("fcmToken", "ok")).andExpect(status().isUnauthorized());
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void broadcastReachesOnlyPushSubscribersOfTheTargetArea() throws Exception {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        citizen("in@push-test.example", "t-in", 1, List.of("PUSH"));
        citizen("smsonly@push-test.example", "t-sms", 1, List.of("SMS"));
        citizen("otherarea@push-test.example", "t-other", 2, List.of("PUSH"));
        citizen("nosub@push-test.example", "t-nosub", null, List.of());

        JsonNode byName = broadcast(admin(), Map.of("riskLevel", "HIGH", "message", "Evacuate now", "targetArea", "Mù Cang Chải"));

        assertEquals("DISPATCHED", byName.get("status").asText());
        assertEquals(1, byName.get("recipients_estimated").asInt());
        assertEquals(1, byName.get("sent").asInt());
        assertEquals("high", byName.get("risk_level").asText());
        ArgumentCaptor<FcmSender.Message> sent = ArgumentCaptor.forClass(FcmSender.Message.class);
        verify(fcm, times(1)).send(eq("t-in"), sent.capture());
        verifyNoMoreInteractions(fcm);
        Map<String, String> data = sent.getValue().data();
        assertEquals("EMERGENCY_ALERT", data.get("type"));
        assertEquals(byName.get("broadcast_id").asText(), data.get("broadcastId"));
        assertEquals("high", data.get("severity"));
        assertEquals("Evacuate now", sent.getValue().body());
        Instant until = Instant.parse(data.get("validUntil"));
        assertTrue(Duration.between(Instant.now(), until).toHours() >= 23);
        assertTrue(Instant.parse(data.get("issuedAt")).isBefore(until));

        // same result when the admin names the area by id
        reset(fcm);
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        assertEquals(1, broadcast(admin2(), Map.of("riskLevel", "extreme", "areaId", 1)).get("sent").asInt());
        verify(fcm, times(1)).send(eq("t-in"), any());
    }

    private String admin2() throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "admin@push-test.example", "password", "secret123"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void nothingIsSentWithoutAMatchingAreaOrRecipients() throws Exception {
        String admin = admin();
        citizen("lonely@push-test.example", "t-lonely", 2, List.of("PUSH"));
        for (Map<String, Object> body : List.of(
            Map.<String, Object>of("riskLevel", "high", "targetArea", "Atlantis"),
            Map.<String, Object>of("riskLevel", "high", "targetArea", "  "),
            Map.<String, Object>of("riskLevel", "high", "areaId", 1),   // nobody follows area 1
            Map.<String, Object>of("riskLevel", "high", "areaId", 99999))) {
            JsonNode result = broadcast(admin, body);
            assertEquals("NO_RECIPIENTS", result.get("status").asText());
            assertEquals(0, result.get("recipients_estimated").asInt());
        }
        verifyNoInteractions(fcm);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM core_schema.alert_broadcasts", Integer.class));
    }

    @Test
    void broadcastNeedsAnAdminAndAKnownRiskLevel() throws Exception {
        String citizen = register("plain@push-test.example");
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", citizen, Map.of("riskLevel", "high", "areaId", 1)).andExpect(status().isForbidden());
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", null, Map.of("riskLevel", "high", "areaId", 1)).andExpect(status().isUnauthorized());
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin(), Map.of("riskLevel", "apocalypse", "areaId", 1)).andExpect(status().isBadRequest());
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin2(), Map.of("areaId", 1)).andExpect(status().isBadRequest());
    }

    @Test
    void aFailedPushIsReportedAsFailedForgottenWhenUnregisteredAndStillResyncable() throws Exception {
        when(fcm.send(eq("t-dead"), any())).thenReturn(FcmSender.Result.unregisteredToken("FCM 404: UNREGISTERED"));
        String user = citizen("dead@push-test.example", "t-dead", 1, List.of("PUSH"));

        JsonNode result = broadcast(admin(), Map.of("riskLevel", "high", "areaId", 1));

        assertEquals("FAILED", result.get("status").asText());
        assertEquals(1, result.get("failed").asInt());
        assertEquals(0, result.get("sent").asInt());
        assertTrue(result.get("first_error").asText().contains("UNREGISTERED"));
        assertEquals(0, owners("t-dead"), "an unregistered token is dropped");
        assertEquals("failed", jdbc.queryForObject("SELECT status::text FROM core_schema.alert_deliveries", String.class));
        // the citizen never got the push but can still fetch the alert on the next resync
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", user, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].broadcastId").value(result.get("broadcast_id").asText()));
    }

    @Test
    void resyncShowsOwnBroadcastsWithValidityRevocationAndExpiry() throws Exception {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        String user = citizen("sync@push-test.example", "t-sync", 1, List.of("PUSH"));
        String stranger = register("stranger@push-test.example");
        String admin = admin();
        JsonNode first = broadcast(admin, Map.of("riskLevel", "extreme", "areaId", 1, "message", "Evacuate"));
        String id = first.get("broadcast_id").asText();

        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", user, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].broadcastId").value(id))
            .andExpect(jsonPath("$[0].severity").value("extreme"))
            .andExpect(jsonPath("$[0].message").value("Evacuate"))
            .andExpect(jsonPath("$[0].areaName").isNotEmpty())
            .andExpect(jsonPath("$[0].status").value("active"))
            .andExpect(jsonPath("$[0].expired").value(false))
            .andExpect(jsonPath("$[0].issuedAt").isNotEmpty())
            .andExpect(jsonPath("$[0].validUntil").isNotEmpty());
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", stranger, null).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        jdbc.update("UPDATE core_schema.alert_broadcasts SET valid_until = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE broadcast_id = CAST(? AS uuid)", id);
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", user, null).andExpect(jsonPath("$[0].expired").value(true));

        call(HttpMethod.POST, "/api/v1/notifications/broadcast/" + id + "/revoke", user, null).andExpect(status().isForbidden());
        call(HttpMethod.POST, "/api/v1/notifications/broadcast/" + id + "/revoke", admin, null).andExpect(status().isNoContent());
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", user, null).andExpect(jsonPath("$[0].status").value("revoked"));
        call(HttpMethod.POST, "/api/v1/notifications/broadcast/" + id + "/revoke", admin, null).andExpect(status().isNotFound());

        // older than 7 days is no longer part of the resync
        jdbc.update("UPDATE core_schema.alert_broadcasts SET broadcast_time = CURRENT_TIMESTAMP - INTERVAL '8 days' WHERE broadcast_id = CAST(? AS uuid)", id);
        call(HttpMethod.GET, "/api/v1/alerts/broadcasts", user, null).andExpect(jsonPath("$.length()").value(0));
    }
}
