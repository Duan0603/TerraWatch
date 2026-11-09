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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.FcmSender;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Story 4.27: every successful admin action leaves a row; the log itself is admin-only. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class AdminAuditApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;

    private String call(HttpMethod method, String path, String token, Object body, int expected) throws Exception {
        MockHttpServletRequestBuilder b = request(method, path);
        if (token != null) b.header("Authorization", "Bearer " + token);
        if (body != null) b.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(b).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
    }

    private JsonNode register(String email) throws Exception {
        return json.readTree(call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "Audit Test", "email", email, "password", "secret123"), 201));
    }

    private String loginAs(String email, String role) throws Exception {
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear();
        return json.readTree(call(HttpMethod.POST, "/api/v1/auth/login", null,
            Map.of("email", email, "password", "secret123"), 200)).get("token").asText();
    }

    @Test
    void adminActionsAreLoggedAndTheLogIsAdminOnly() throws Exception {
        register("admin-audit@example.com");
        String admin = loginAs("admin-audit@example.com", "admin");
        register("officer-audit@example.com");
        String officer = loginAs("officer-audit@example.com", "officer");
        String targetId = register("target-audit@example.com").get("user").get("userId").asText();

        call(HttpMethod.GET, "/api/v1/admin/audit", null, null, 401);
        call(HttpMethod.GET, "/api/v1/admin/audit", officer, null, 403);

        call(HttpMethod.PATCH, "/api/v1/admin/users/" + targetId + "/status", admin, Map.of("isActive", false), 200);
        call(HttpMethod.PATCH, "/api/v1/admin/users/" + targetId + "/role", admin, Map.of("role", "officer"), 200);
        // a refused action (unknown user) must not leave a row
        call(HttpMethod.PATCH, "/api/v1/admin/users/" + UUID.randomUUID() + "/status", admin, Map.of("isActive", false), 404);

        JsonNode rows = json.readTree(call(HttpMethod.GET, "/api/v1/admin/audit", admin, null, 200));
        assertEquals(2, rows.size());
        assertEquals("USER_ROLE", rows.get(0).get("action").asText()); // newest first
        assertEquals("role=officer", rows.get(0).get("detail").asText());
        assertEquals("USER_LOCK", rows.get(1).get("action").asText());
        assertEquals("target-audit@example.com", rows.get(1).get("targetLabel").asText());
        assertEquals("admin-audit@example.com", rows.get(1).get("actor").asText());
    }
}
