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
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.client.FcmSender;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class ModelCardApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;
    @MockBean AiServiceClient ai;

    private String token(String email, String role) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("fullName", "Card Test", "email", email, "password", "secret123"))))
            .andExpect(status().isCreated());
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear();
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", email, "password", "secret123"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void modelCardIsStaffOnly() throws Exception {
        String citizen = token("citizen-card@example.com", "citizen");
        mvc.perform(get("/api/v1/model-card")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/model-card").header("Authorization", "Bearer " + citizen)).andExpect(status().isForbidden());
    }

    @Test
    void officerAndAdminGetTheCardsExactlyAsTheAiServiceReportsThem() throws Exception {
        when(ai.segmentationCard()).thenReturn(Map.of("ready", true, "name", "demo-model", "version", "v1.0"));
        when(ai.gruCard()).thenReturn(Map.of("ready", true, "calibrated_probability", false));
        for (String role : new String[]{"officer", "admin"}) {
            String t = token(role + "-card@example.com", role);
            JsonNode root = json.readTree(mvc.perform(get("/api/v1/model-card").header("Authorization", "Bearer " + t))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertEquals("demo-model", root.get("segmentation").get("name").asText());
            assertFalse(root.get("gru").get("calibrated_probability").asBoolean());
        }
    }

    @Test
    void whenTheAiServiceIsDownTheAnswerSaysNotReadyAndInventsNothing() throws Exception {
        when(ai.segmentationCard()).thenReturn(Map.of("ready", false));
        when(ai.gruCard()).thenReturn(Map.of("ready", false));
        String t = token("officer-card-down@example.com", "officer");
        JsonNode root = json.readTree(mvc.perform(get("/api/v1/model-card").header("Authorization", "Bearer " + t))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertFalse(root.get("segmentation").get("ready").asBoolean());
        assertEquals(1, root.get("segmentation").size());
    }
}
