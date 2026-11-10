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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Story 4.34: review performance numbers (counts are compared as deltas: the test database may hold other rows). */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class ForecastReviewMetricsApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;

    private String token(String email, String role) throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("fullName", "Review Tester", "email", email, "password", "secret123"))))
            .andExpect(status().isCreated());
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear();
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "secret123"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private void unit(String id) {
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, id);
    }

    private UUID run(String unitId, String validFrom, String validUntil, String availability) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active, job_status, idempotency_key)
            VALUES (?, ?, now(), now() + CAST(? AS interval), now() + CAST(? AS interval), ?, 0.8, 'high', 'm', 't',
                CAST('pending' AS core_schema.forecast_review_status), TRUE, 'completed', ?)
            """, id, unitId, validFrom, validUntil, availability, "key-" + id);
        return id;
    }

    private org.springframework.test.web.servlet.ResultActions review(String token, UUID id, String decision, String reason) throws Exception {
        Map<String, Object> body = reason == null ? Map.of("decision", decision) : Map.of("decision", decision, "reasonNotes", reason);
        return mvc.perform(patch("/api/v1/forecasts/" + id + "/review").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private JsonNode metrics(String token, String query) throws Exception {
        return json.readTree(mvc.perform(get("/api/v1/forecasts/reviews/metrics" + query).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    /** A run issued {@code issuedAgo} ago and decided {@code decidedAgo} ago (both Postgres intervals), decision recorded directly. */
    private void decidedRun(String unitId, String issuedAgo, String decidedAgo, String decision) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active, job_status, idempotency_key)
            VALUES (?, ?, now() - CAST(? AS interval), now() - CAST(? AS interval), now() + interval '20 hours', 'available', 0.8, 'high', 'm', 't',
                CAST(? AS core_schema.forecast_review_status), TRUE, 'completed', ?)
            """, id, unitId, issuedAgo, issuedAgo, decision, "key-" + id);
        jdbc.update("INSERT INTO core_schema.forecast_reviews (run_id, decision, reviewed_at) VALUES (?, CAST(? AS core_schema.forecast_review_status), now() - CAST(? AS interval))",
            id, decision, decidedAgo);
    }

    @Test
    void metricsCountDecisionsTimeToDecideAndExpiredUnreviewed() throws Exception {
        String token = token("metrics-officer@api-test.example", "officer");
        JsonNode before = metrics(token, "?days=7");

        unit("MET_U1");
        decidedRun("MET_U1", "5 hours", "4 hours", "approved");   // decided after 60 min
        unit("MET_U2");
        decidedRun("MET_U2", "5 hours", "3 hours", "rejected");   // decided after 120 min
        unit("MET_U3");
        run("MET_U3", "-30 hours", "-6 hours", "available");      // expired, still pending
        unit("MET_U4");
        run("MET_U4", "-30 hours", "-6 hours", "unavailable");    // could never be approved: not counted

        JsonNode after = metrics(token, "?days=7");
        assertEquals(7, after.get("windowDays").asInt());
        assertEquals(before.get("approved").asLong() + 1, after.get("approved").asLong());
        assertEquals(before.get("rejected").asLong() + 1, after.get("rejected").asLong());
        assertEquals(before.get("expiredUnreviewed").asLong() + 1, after.get("expiredUnreviewed").asLong());
        assertTrue(after.get("avgMinutes").asDouble() > 0);
        assertTrue(after.get("medianMinutes").asDouble() > 0);
    }

    @Test
    void oldDecisionsFallOutOfTheWindowAndNothingDecidedMeansNullNotZero() throws Exception {
        String token = token("metrics-officer2@api-test.example", "officer");
        unit("MET_U5");
        decidedRun("MET_U5", "9 days 2 hours", "9 days", "approved"); // outside 7 days, inside 30
        JsonNode week = metrics(token, "?days=7");
        JsonNode month = metrics(token, "?days=30");
        assertEquals(1, month.get("approved").asLong() - week.get("approved").asLong());
        assertEquals(1, metrics(token, "?days=0").get("windowDays").asInt(), "window is clamped to at least 1 day");
        assertEquals(90, metrics(token, "?days=9999").get("windowDays").asInt(), "and at most 90");
    }

    @Test
    void metricsAreStaffOnly() throws Exception {
        String citizen = token("metrics-citizen@api-test.example", "citizen");
        mvc.perform(get("/api/v1/forecasts/reviews/metrics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/forecasts/reviews/metrics").header("Authorization", "Bearer " + citizen)).andExpect(status().isForbidden());
    }
}
