package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class ForecastApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String token() throws Exception {
        String body = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("fullName", "Forecast User", "email", "forecast@api-test.example", "password", "secret123"))))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private void unit(String id) {
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, id);
    }

    private UUID run(String unitId, String review, boolean active, String availability, String validFrom, String validUntil) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active)
            VALUES (?, ?, now(), now() + CAST(? AS interval), now() + CAST(? AS interval), ?, 0.82, 'high', 'xgb-test', 'th-test',
                CAST(? AS core_schema.forecast_review_status), ?)
            """, id, unitId, validFrom, validUntil, availability, review, active);
        return id;
    }

    private JsonNode sync(String token) throws Exception {
        return json.readTree(mvc.perform(get("/api/v1/forecasts/offline-sync").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private Set<String> runIds(JsonNode body) {
        return StreamSupport.stream(body.get("items").spliterator(), false).map(i -> i.get("runId").asText()).collect(Collectors.toSet());
    }

    @Test
    void requiresASignedInUser() throws Exception {
        mvc.perform(get("/api/v1/forecasts/offline-sync")).andExpect(status().isUnauthorized());
    }

    @Test
    void returnsOnlyApprovedActiveAvailableUnexpiredRunsWithGeometryAndValidity() throws Exception {
        unit("TEST_U1");
        UUID current = run("TEST_U1", "approved", true, "available", "-1 hour", "23 hours");
        UUID upcoming = run("TEST_U1", "approved", true, "available", "1 hour", "25 hours");
        Set<UUID> hidden = Set.of(
            run("TEST_U1", "pending", true, "available", "-1 hour", "23 hours"),
            run("TEST_U1", "rejected", true, "available", "-1 hour", "23 hours"),
            run("TEST_U1", "superseded", true, "available", "-1 hour", "23 hours"),
            run("TEST_U1", "approved", false, "available", "-1 hour", "23 hours"),
            run("TEST_U1", "approved", true, "unavailable", "-1 hour", "23 hours"),
            run("TEST_U1", "approved", true, "available", "-25 hours", "-1 hour"));

        JsonNode body = sync(token());

        Set<String> ids = runIds(body);
        assertEquals(Set.of(current.toString(), upcoming.toString()), ids);
        hidden.forEach(h -> assertTrue(!ids.contains(h.toString())));
        JsonNode item = StreamSupport.stream(body.get("items").spliterator(), false)
            .filter(i -> i.get("runId").asText().equals(current.toString())).findFirst().orElseThrow();
        assertEquals("TEST_U1", item.get("unitId").asText());
        assertEquals("high", item.get("hazardLevel").asText());
        assertEquals(0.82, item.get("probability").asDouble(), 1e-9);
        assertEquals("xgb-test", item.get("modelVersion").asText());
        assertEquals("Polygon", item.get("geometry").get("type").asText());
        assertTrue(item.get("validUntil").asText().endsWith("Z"), "instants are UTC");
        assertTrue(item.get("validFrom").asText().compareTo(item.get("validUntil").asText()) < 0);
        assertTrue(body.get("serverTime").asText().endsWith("Z"));
    }

    @Test
    void aRevokedRunDisappearsFromTheNextSnapshot() throws Exception {
        unit("TEST_U2");
        UUID id = run("TEST_U2", "approved", true, "available", "-1 hour", "23 hours");
        String token = token();
        assertTrue(runIds(sync(token)).contains(id.toString()));

        jdbc.update("UPDATE core_schema.forecast_runs SET review_status = CAST('superseded' AS core_schema.forecast_review_status) WHERE run_id = ?", id);

        assertTrue(!runIds(sync(token)).contains(id.toString()));
    }
}
