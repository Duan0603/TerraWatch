package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import vn.terrawatch.core.client.SmsSender;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Story 4.39: SMS broadcast, incident phase tagging, and preview with smsSubscribers. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class SmsBroadcastApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;
    @MockBean SmsSender sms;

    /** Remove seed SMS subscription from V15 migration to avoid interference. */
    @BeforeEach
    void cleanSeed() {
        jdbc.update("DELETE FROM core_schema.alert_subscriptions WHERE user_id = '33333333-3333-3333-3333-333333333333'");
    }

    private ResultActions call(HttpMethod method, String path, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }

    private String register(String email) throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "SMS Test", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private String admin() throws Exception {
        register("sms-admin@test.example");
        jdbc.update("UPDATE core_schema.users SET role = CAST('admin' AS core_schema.user_role) WHERE email = 'sms-admin@test.example'");
        entityManager.clear();
        String body = call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "sms-admin@test.example", "password", "secret123"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    /** Register a citizen with a phone number and SMS subscription for area 1. */
    private void citizenWithSms(String email, String phone) throws Exception {
        String token = register(email);
        // register a device token so push subscription works too
        call(HttpMethod.POST, "/api/v1/alerts/devices/register", token, Map.of("fcmToken", "fcm-" + email, "deviceType", "android"))
            .andExpect(status().isNoContent());
        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", token,
            Map.of("areaId", 1, "alertChannels", List.of("PUSH", "SMS"), "phoneNumber", phone))
            .andExpect(status().isOk());
    }

    @Test
    void broadcastWithIncidentPhaseSendsSmsToSubscribedCitizens() throws Exception {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.sent("SM_TEST_SID"));
        citizenWithSms("sms-citizen@test.example", "0854346968");
        String adminToken = admin();

        JsonNode result = json.readTree(
            call(HttpMethod.POST, "/api/v1/notifications/broadcast", adminToken,
                Map.of("riskLevel", "high", "areaId", 1, "incidentPhase", "pre_incident"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());

        // FCM push delivered
        assertEquals("DISPATCHED", result.get("status").asText());
        assertEquals(1, result.get("sent").asInt());
        // SMS delivered
        assertEquals(1, result.get("sms_sent").asInt());
        assertEquals(0, result.get("sms_failed").asInt());
        assertTrue(result.get("channels").toString().contains("SMS"));
        assertEquals("pre_incident", result.get("incident_phase").asText());

        // DB: incident_phase stored
        String phase = jdbc.queryForObject("SELECT incident_phase FROM core_schema.alert_broadcasts", String.class);
        assertEquals("pre_incident", phase);

        // DB: SMS delivery row exists with channel='sms'
        int smsDeliveries = jdbc.queryForObject(
            "SELECT count(*) FROM core_schema.alert_deliveries WHERE channel = 'sms'", Integer.class);
        assertEquals(1, smsDeliveries);

        // DB: provider_message_id stored
        String sid = jdbc.queryForObject(
            "SELECT provider_message_id FROM core_schema.alert_deliveries WHERE channel = 'sms'", String.class);
        assertEquals("SM_TEST_SID", sid);

        verify(sms, times(1)).send(anyString(), anyString());
    }

    @Test
    void invalidIncidentPhaseReturnsBadRequest() throws Exception {
        String adminToken = admin();
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", adminToken,
            Map.of("riskLevel", "high", "areaId", 1, "incidentPhase", "apocalypse"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void previewIncludesSmsSubscriberCount() throws Exception {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        citizenWithSms("preview-sms@test.example", "0912345678");
        String adminToken = admin();

        call(HttpMethod.GET, "/api/v1/notifications/broadcast/preview?areaId=1", adminToken, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.smsSubscribers").isNumber());
    }

    @Test
    void smsFailureIsRecordedButDoesNotBlockPush() throws Exception {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.failed("Twilio 400: invalid phone"));
        citizenWithSms("sms-fail@test.example", "0000000000");
        String adminToken = admin();

        JsonNode result = json.readTree(
            call(HttpMethod.POST, "/api/v1/notifications/broadcast", adminToken,
                Map.of("riskLevel", "extreme", "areaId", 1))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());

        // Push still dispatched even though SMS failed
        assertEquals("DISPATCHED", result.get("status").asText());
        assertEquals(1, result.get("sms_failed").asInt());
        assertEquals(0, result.get("sms_sent").asInt());

        // DB: SMS delivery row has status=failed and error_message
        String smsStatus = jdbc.queryForObject(
            "SELECT status::text FROM core_schema.alert_deliveries WHERE channel = 'sms'", String.class);
        assertEquals("failed", smsStatus);
    }
}

