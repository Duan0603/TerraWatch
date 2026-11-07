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

/** Stories 4.2/4.3: review queue with evidence, and guards on the review decision. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class ForecastReviewQueueApiTest {
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

    @Test
    void queueListsPendingRunsWithGeometryExpiryAndEvidence() throws Exception {
        unit("RQ_U1");
        UUID live = run("RQ_U1", "-1 hour", "23 hours", "available");
        UUID expired = run("RQ_U1", "-30 hours", "-6 hours", "available");
        jdbc.update("""
            INSERT INTO gis_schema.rainfall_observations (unit_id, interval_start, interval_end, available_at, rainfall_mm, source_provider)
            VALUES ('RQ_U1', now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours', 12.5, 'TEST'),
                   ('RQ_U1', now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour', NULL, 'TEST')
            """);
        String token = token("rq-officer@api-test.example", "officer");

        JsonNode items = json.readTree(mvc.perform(get("/api/v1/forecasts/review-queue").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        JsonNode liveItem = null, expiredItem = null;
        for (JsonNode n : items) {
            if (n.get("runId").asText().equals(live.toString())) liveItem = n;
            if (n.get("runId").asText().equals(expired.toString())) expiredItem = n;
        }
        assertNotNull(liveItem);
        assertFalse(liveItem.get("expired").asBoolean());
        assertEquals("Polygon", liveItem.get("unit").get("geometry").get("type").asText());
        assertEquals(2, liveItem.get("observedRain").size());
        assertTrue(liveItem.get("observedRain").get(1).get("mm").isNull(), "missing rainfall must stay null, never 0");
        assertNotNull(expiredItem);
        assertTrue(expiredItem.get("expired").asBoolean());
    }

    @Test
    void citizenCannotReadTheQueue() throws Exception {
        String token = token("rq-citizen@api-test.example", "citizen");
        mvc.perform(get("/api/v1/forecasts/review-queue").header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    void rejectedStatusFilterIsValidated() throws Exception {
        String token = token("rq-officer2@api-test.example", "officer");
        mvc.perform(get("/api/v1/forecasts/review-queue?status=bogus").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
    }

    @Test
    void expiredRunCannotBeReviewed() throws Exception {
        unit("RQ_U2");
        UUID expired = run("RQ_U2", "-30 hours", "-6 hours", "available");
        review(token("rq-officer3@api-test.example", "officer"), expired, "approved", null).andExpect(status().isConflict());
    }

    @Test
    void runCannotBeReviewedTwice() throws Exception {
        unit("RQ_U3");
        UUID id = run("RQ_U3", "-1 hour", "23 hours", "available");
        String token = token("rq-officer4@api-test.example", "officer");
        review(token, id, "approved", null).andExpect(status().isOk());
        review(token, id, "rejected", "changed my mind").andExpect(status().isConflict());
    }

    @Test
    void rejectionNeedsAReasonAndUnavailableRunCannotBeApproved() throws Exception {
        unit("RQ_U4");
        UUID live = run("RQ_U4", "-1 hour", "23 hours", "available");
        unit("RQ_U5");
        UUID unavailable = run("RQ_U5", "-1 hour", "23 hours", "unavailable");
        String token = token("rq-officer5@api-test.example", "officer");
        review(token, live, "rejected", "  ").andExpect(status().isBadRequest());
        review(token, unavailable, "approved", null).andExpect(status().isConflict());
    }

    @Test
    void reviewAuditLogReturnsReviewedHistoryWithReviewerInfo() throws Exception {
        unit("RQ_AUDIT_1");
        UUID live = run("RQ_AUDIT_1", "-1 hour", "23 hours", "available");
        String token = token("audit-officer@api-test.example", "officer");
        review(token, live, "approved", "Approved based on field survey").andExpect(status().isOk());

        String res = mvc.perform(get("/api/v1/forecasts/reviews/audit").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        JsonNode audits = json.readTree(res);
        assertTrue(audits.size() > 0);
        JsonNode first = audits.get(0);
        assertEquals("approved", first.get("decision").asText());
        assertEquals("Review Tester", first.get("reviewerName").asText());
        assertEquals("RQ_AUDIT_1", first.get("unitId").asText());
        assertEquals("Approved based on field survey", first.get("reasonNotes").asText());
    }
}
