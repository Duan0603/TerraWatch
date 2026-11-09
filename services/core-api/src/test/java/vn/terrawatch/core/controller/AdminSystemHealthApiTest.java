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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.FcmSender;

import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class AdminSystemHealthApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;

    private String token(String email, String role) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("fullName", "Health Test", "email", email, "password", "secret123"))))
            .andExpect(status().isCreated());
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear();
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", email, "password", "secret123"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void systemHealthIsAdminOnlyAndReportsEveryComponent() throws Exception {
        String officer = token("officer-health@example.com", "officer");
        String admin = token("admin-health@example.com", "admin");

        mvc.perform(get("/api/v1/admin/system-health")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/system-health").header("Authorization", "Bearer " + officer))
            .andExpect(status().isForbidden());

        String body = mvc.perform(get("/api/v1/admin/system-health").header("Authorization", "Bearer " + admin))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode root = json.readTree(body);
        assertEquals(4, root.get("components").size());
        assertEquals("ok", root.get("components").get(0).get("status").asText()); // the test database answers
        for (JsonNode c : root.get("components")) {
            assertTrue(Set.of("ok", "degraded", "down").contains(c.get("status").asText()));
            assertFalse(c.get("detail").asText().contains("http")); // no internal addresses leak to the browser
        }
        assertEquals(4, root.get("freshness").size());
        assertTrue(root.get("checkedAt").asText().endsWith("Z"));
    }
}
