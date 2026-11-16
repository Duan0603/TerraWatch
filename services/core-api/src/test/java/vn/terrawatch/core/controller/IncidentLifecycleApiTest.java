package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Landslide incident verification (ST-INC-001..024): every stored state met with every officer decision, asserted over HTTP
 * and in the stored row, the audit trigger rows, the event published and the two lists that read the state.
 * Notes on the CSV: ST-INC-002 says "4xx, not 500" for a verify without a risk level; since Story 4.23 a missing level keeps
 * the stored one and the call is 200, so the CSV is out of date there (the same real behaviour is tested for the other states).
 * The call never takes the reviewer from the body. Who may call is covered by AuthorizationMatrixTest.
 */
class IncidentLifecycleApiTest extends FlowTestBase {
    private static final String LANDSLIDES = "/api/v1/landslides";
    private static final String STORED_RISK = "low";

    private UUID seedEvent(String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.landslide_events (event_id, geom, risk_level, status, confidence_score, detection_date)
            VALUES (?, ST_GeomFromText('MULTIPOLYGON(((106 10, 106.001 10, 106.001 10.001, 106 10.001, 106 10)))', 4326),
                    CAST(? AS core_schema.risk_level), CAST(? AS core_schema.verification_status), 0.77, now())
            """, id, STORED_RISK, status);
        return id;
    }

    private boolean inQueue(Acct officer, UUID id) throws Exception {
        for (JsonNode row : read(call(HttpMethod.GET, LANDSLIDES + "/queue", officer, null).andExpect(status().isOk()))) {
            if (row.get("event_id").asText().equals(id.toString())) return true;
        }
        return false;
    }

    private boolean inActive(Acct viewer, UUID id) throws Exception {
        for (JsonNode feature : read(call(HttpMethod.GET, LANDSLIDES + "/active", viewer, null).andExpect(status().isOk())).get("features")) {
            if (feature.get("id").asText().equals(id.toString())) return true;
        }
        return false;
    }

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForMap("SELECT status::text AS status, risk_level::text AS risk, officer_note, verified_by, verified_at "
            + "FROM core_schema.landslide_events WHERE event_id = ?", id);
    }

    private List<String> history(UUID id) {
        return jdbc.queryForList("SELECT previous_status::text || '>' || new_status::text FROM core_schema.landslide_event_history "
            + "WHERE event_id = ? ORDER BY history_id", String.class, id);
    }

    // ---- ST-INC-001..004, 007..010, 013..016, 019..022: a decision on an incident in each state ----

    @ParameterizedTest(name = "incident {0}, officer sends {1} (risk {2}) -> stored {3}/{4}, audit rows {5} [{6}]")
    @CsvSource(nullValues = "-", value = {
        "pending,     verified,    extreme, verified,    extreme,     1, ST-INC-001",
        "pending,     verified,    -,       verified,    low,         1, ST-INC-002",
        "pending,     rejected,    -,       rejected,    low,         1, ST-INC-003",
        "pending,     false_alarm, -,       false_alarm, low,         1, ST-INC-004",
        "verified,    verified,    extreme, verified,    extreme,     0, ST-INC-007",
        "verified,    verified,    -,       verified,    low,         0, ST-INC-008",
        "verified,    rejected,    -,       rejected,    low,         1, ST-INC-009",
        "verified,    false_alarm, -,       false_alarm, low,         1, ST-INC-010",
        "rejected,    verified,    extreme, verified,    extreme,     1, ST-INC-013",
        "rejected,    verified,    -,       verified,    low,         1, ST-INC-014",
        "rejected,    rejected,    -,       rejected,    low,         0, ST-INC-015",
        "rejected,    false_alarm, -,       false_alarm, low,         1, ST-INC-016",
        "false_alarm, verified,    extreme, verified,    extreme,     1, ST-INC-019",
        "false_alarm, verified,    -,       verified,    low,         1, ST-INC-020",
        "false_alarm, rejected,    -,       rejected,    low,         1, ST-INC-021",
        "false_alarm, false_alarm, -,       false_alarm, low,         0, ST-INC-022"
    })
    void anOfficerDecisionIsStoredWithTheOfficerAndOnlyARealChangeIsAudited(String from, String decision, String risk, String storedStatus,
                                                                         String storedRisk, int auditRows, String ids) throws Exception {
        Acct officer = account("officer");
        UUID id = seedEvent(from);
        Map<String, Object> body = new HashMap<>();
        body.put("status", decision);
        body.put("riskLevel", risk);
        body.put("officerNote", "note for " + ids);
        body.put("officerId", UUID.randomUUID().toString()); // a client-supplied reviewer is ignored

        JsonNode answer = read(call(HttpMethod.PATCH, LANDSLIDES + "/" + id + "/verify", officer, body).andExpect(status().isOk()));

        assertThat(answer.get("status").asText()).isEqualTo(storedStatus);
        assertThat(answer.get("risk_level").asText()).isEqualTo(storedRisk);
        Map<String, Object> stored = row(id);
        assertThat(stored).containsEntry("status", storedStatus).containsEntry("risk", storedRisk)
            .containsEntry("officer_note", "note for " + ids).containsEntry("verified_by", officer.id());
        assertThat(stored.get("verified_at")).isNotNull();
        // the audit trigger writes one row per real status change and none for a repeat of the same status
        assertThat(history(id)).hasSize(auditRows);
        if (auditRows == 1) assertThat(history(id)).containsExactly(from + ">" + storedStatus);
        verify(events).publishEvent(eq("LANDSLIDE_VERIFIED"), org.mockito.ArgumentMatchers.<Map<String, Object>>argThat(m ->
            m.get("eventId").equals(id.toString()) && m.get("status").equals(decision) && m.get("officerId").equals(officer.id().toString())));
        // what the lists show follows the new state at once: only a verified incident is on the map and none is left in the queue
        assertThat(inActive(officer, id)).isEqualTo(storedStatus.equals("verified"));
        assertThat(inQueue(officer, id)).isFalse();
    }

    // ---- ST-INC-005/006/011/012/017/018/023/024: where an incident in each state is listed ----

    @ParameterizedTest(name = "incident {0}: listed in /active={1}, in /queue={2} [{3}]")
    @CsvSource({
        "pending,     false, true,  ST-INC-005/006",
        "verified,    true,  false, ST-INC-011/012",
        "rejected,    false, false, ST-INC-017/018",
        "false_alarm, false, false, ST-INC-023/024"
    })
    void anIncidentIsListedOnlyWhereItsStateBelongs(String state, boolean active, boolean queued, String ids) throws Exception {
        Acct officer = account("officer");
        UUID id = seedEvent(state);

        assertThat(inActive(officer, id)).isEqualTo(active);
        assertThat(inQueue(officer, id)).isEqualTo(queued);
        // the public map feed needs no sign-in and agrees with the signed-in one
        assertThat(inActive(null, id)).isEqualTo(active);
    }

    // ---- a decision that is refused changes nothing (ties the 4xx cells to the stored row) ----

    @ParameterizedTest(name = "refused decision status={0} risk={1} on a pending incident leaves it pending, unaudited and unannounced [ST-INC-002 4xx side]")
    @CsvSource({"banana, high", "verified, critical"})
    void aRefusedDecisionLeavesThePendingIncidentUntouched(String decision, String risk) throws Exception {
        Acct officer = account("officer");
        UUID id = seedEvent("pending");
        Map<String, Object> body = new HashMap<>();
        body.put("status", decision);
        body.put("riskLevel", risk);

        call(HttpMethod.PATCH, LANDSLIDES + "/" + id + "/verify", officer, body).andExpect(status().isBadRequest());

        assertThat(row(id)).containsEntry("status", "pending").containsEntry("risk", STORED_RISK);
        assertThat(row(id).get("verified_by")).isNull();
        assertThat(history(id)).isEmpty();
        assertThat(inQueue(officer, id)).isTrue();
        verify(events, never()).publishEvent(eq("LANDSLIDE_VERIFIED"), anyMap());
    }
}
