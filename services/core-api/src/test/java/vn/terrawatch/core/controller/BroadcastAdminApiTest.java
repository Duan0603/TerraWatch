package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.FcmSender;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Story 4.5: admin broadcast history and recipient preview, and unique monitoring area names. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class BroadcastAdminApiTest {
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
            Map.of("fullName", "History Test", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private String withRole(String email, String role) throws Exception {
        register(email);
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear(); // the JDBC update bypasses the JPA cache the login would otherwise read
        String body = call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", email, "password", "secret123"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private void subscriber(String email, String fcmToken, int areaId) throws Exception {
        String token = register(email);
        if (fcmToken != null) {
            call(HttpMethod.POST, "/api/v1/alerts/devices/register", token, Map.of("fcmToken", fcmToken)).andExpect(status().isNoContent());
        }
        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", token, Map.of("areaId", areaId, "alertChannels", List.of("PUSH")))
            .andExpect(status().isOk());
        entityManager.flush(); // the subscription is saved with JPA; the recipient queries use plain SQL in the same test transaction
    }

    @Test
    void historyAndPreviewAreAdminOnly() throws Exception {
        String officer = withRole("officer@history-test.example", "officer");
        for (String path : List.of("/api/v1/notifications/broadcasts", "/api/v1/notifications/broadcast/preview?areaId=1")) {
            call(HttpMethod.GET, path, null, null).andExpect(status().isUnauthorized());
            call(HttpMethod.GET, path, officer, null).andExpect(status().isForbidden());
        }
    }

    @Test
    void previewCountsPushSubscribersAndTheirPhonesBeforeSending() throws Exception {
        String admin = withRole("admin@history-test.example", "admin");
        call(HttpMethod.GET, "/api/v1/notifications/broadcast/preview?areaId=1", admin, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.subscribers").value(0)).andExpect(jsonPath("$.devices").value(0));

        subscriber("with-phone@history-test.example", "phone-a", 1);
        subscriber("no-phone@history-test.example", null, 1);
        subscriber("other-area@history-test.example", "phone-b", 2);

        call(HttpMethod.GET, "/api/v1/notifications/broadcast/preview?areaId=1", admin, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.areaId").value(1))
            .andExpect(jsonPath("$.areaName").isNotEmpty())
            .andExpect(jsonPath("$.subscribers").value(2))
            .andExpect(jsonPath("$.devices").value(1));
        call(HttpMethod.GET, "/api/v1/notifications/broadcast/preview?areaId=99999", admin, null).andExpect(status().isNotFound());
    }

    @Test
    void historyListsSentBroadcastsNewestFirstWithCountsSenderAndRevocation() throws Exception {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        String admin = withRole("admin2@history-test.example", "admin");
        subscriber("reader@history-test.example", "phone-c", 1);

        String firstBody = call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin,
                Map.of("riskLevel", "high", "areaId", 1, "message", "Lenh thu nhat"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode first = json.readTree(firstBody);
        assertTrue(first.hasNonNull("broadcast_id"), firstBody);
        jdbc.update("UPDATE core_schema.alert_broadcasts SET broadcast_time = broadcast_time - INTERVAL '1 minute' WHERE broadcast_id = CAST(? AS uuid)",
            first.get("broadcast_id").asText());
        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin, Map.of("riskLevel", "extreme", "areaId", 1, "message", "Lenh thu hai"))
            .andExpect(status().isOk());
        call(HttpMethod.POST, "/api/v1/notifications/broadcast/" + first.get("broadcast_id").asText() + "/revoke", admin, null)
            .andExpect(status().isNoContent());

        call(HttpMethod.GET, "/api/v1/notifications/broadcasts", admin, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].message").value("Lenh thu hai"))
            .andExpect(jsonPath("$[0].severity").value("extreme"))
            .andExpect(jsonPath("$[0].status").value("active"))
            .andExpect(jsonPath("$[0].recipients").value(1))
            .andExpect(jsonPath("$[0].sent").value(1))
            .andExpect(jsonPath("$[0].failed").value(0))
            .andExpect(jsonPath("$[0].senderName").value("History Test"))
            .andExpect(jsonPath("$[0].areaName").isNotEmpty())
            .andExpect(jsonPath("$[1].message").value("Lenh thu nhat"))
            .andExpect(jsonPath("$[1].status").value("revoked"))
            .andExpect(jsonPath("$[1].revokedAt").isNotEmpty());
        call(HttpMethod.GET, "/api/v1/notifications/broadcasts?limit=1", admin, null).andExpect(jsonPath("$.length()").value(1));

        call(HttpMethod.GET, "/api/v1/notifications/broadcast/" + first.get("broadcast_id").asText() + "/deliveries", admin, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].recipientName").value("History Test"))
            .andExpect(jsonPath("$[0].status").value("sent"));
    }

    @Test
    void onlyAnAdminCreatesAreasAndADuplicateNameIsAConflict() throws Exception {
        Map<String, Object> square = Map.of("type", "Polygon", "coordinates", List.of(List.of(
            List.of(104.0, 22.0), List.of(104.1, 22.0), List.of(104.1, 22.1), List.of(104.0, 22.1), List.of(104.0, 22.0))));
        Map<String, Object> area = Map.of("name", "Vung thu Story 4.5", "description", "test", "geojson", square);
        call(HttpMethod.POST, "/api/v1/monitoring-areas", null, area).andExpect(status().isUnauthorized());
        call(HttpMethod.POST, "/api/v1/monitoring-areas", withRole("officer2@history-test.example", "officer"), area)
            .andExpect(status().isForbidden());

        String admin = withRole("admin3@history-test.example", "admin");
        call(HttpMethod.POST, "/api/v1/monitoring-areas", admin, area).andExpect(status().isOk());
        call(HttpMethod.POST, "/api/v1/monitoring-areas", admin, area)
            .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("A monitoring area with this name already exists"));
        // GET stays public: covered by AuthControllerTest (this transaction is aborted by the duplicate insert)
    }

    @Test
    void monitoringAreaNamesAreUnique() {
        Integer duplicates = jdbc.queryForObject(
            "SELECT COUNT(*) FROM (SELECT name FROM gis_schema.monitoring_areas GROUP BY name HAVING COUNT(*) > 1) d", Integer.class);
        assertEquals(0, duplicates);
        String existing = jdbc.queryForObject("SELECT name FROM gis_schema.monitoring_areas ORDER BY area_id LIMIT 1", String.class);
        assertThrows(DuplicateKeyException.class, () -> jdbc.update(
            "INSERT INTO gis_schema.monitoring_areas (name, geom) SELECT name, geom FROM gis_schema.monitoring_areas WHERE name = ?", existing));
    }

    @Test
    void adminCanUpdateMonitoringArea() throws Exception {
        String admin = withRole("admin-update-area@history-test.example", "admin");
        Map<String, Object> square = Map.of("type", "Polygon", "coordinates", List.of(List.of(
            List.of(105.0, 21.0), List.of(105.1, 21.0), List.of(105.1, 21.1), List.of(105.0, 21.1), List.of(105.0, 21.0))));
        String created = call(HttpMethod.POST, "/api/v1/monitoring-areas", admin,
            Map.of("name", "Vung Ban Dau", "description", "truoc cap nhat", "geojson", square))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        int areaId = json.readTree(created).get("area_id").asInt();

        // Update name and description
        call(HttpMethod.PUT, "/api/v1/monitoring-areas/" + areaId, admin,
            Map.of("name", "Vung Sau Cap Nhat", "description", "da cap nhat", "isActive", true))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Vung Sau Cap Nhat"))
            .andExpect(jsonPath("$.description").value("da cap nhat"));
    }
}
