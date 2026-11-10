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
import vn.terrawatch.core.service.LiveUpdateHub;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class LiveUpdatesApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;
    @Autowired LiveUpdateHub hub;

    private String token(String email, String role) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("fullName", "Live Test", "email", email, "password", "secret123"))))
            .andExpect(status().isCreated());
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear();
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("email", email, "password", "secret123"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void streamIsStaffOnly() throws Exception {
        String citizen = token("citizen-live@example.com", "citizen");
        mvc.perform(get("/api/v1/stream")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/stream").header("Authorization", "Bearer " + citizen)).andExpect(status().isForbidden());
    }

    @Test
    void officerReceivesHelloThenTheUpdatesThatArePublished() throws Exception {
        String officer = token("officer-live@example.com", "officer");
        int before = hub.subscribers();

        var result = mvc.perform(get("/api/v1/stream").header("Authorization", "Bearer " + officer))
            .andExpect(request().asyncStarted()).andReturn();
        assertEquals(before + 1, hub.subscribers());

        hub.publish("queue");
        hub.publish("field_reports");

        String body = result.getResponse().getContentAsString();
        assertTrue(body.contains("event:hello"), body);
        assertTrue(body.contains("event:update"), body);
        assertTrue(body.contains("{\"type\":\"queue\"}"), body);
        assertTrue(body.contains("{\"type\":\"field_reports\"}"), body);
        assertFalse(body.contains("token"), "an event never carries data or credentials");
    }

    @Test
    void publishingWithNobodyConnectedIsHarmless() {
        assertDoesNotThrow(() -> new LiveUpdateHub().publish("queue"));
    }
}
