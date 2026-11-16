package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Field report status (ST-RPT-001..018): each stored status met with each officer change, the unknown value, a citizen's attempt
 * and the owner reading the report again. Not repeated, because CommunityReportFlowApiTest and FieldReportApiTest already assert
 * them: ST-RPT-002 (submitted to processed), ST-RPT-004 (unknown value on a submitted report), ST-RPT-009 (processed to archived).
 * The code has no transition table: every officer change between the three values, also backwards and to the same value, is a
 * 200 that stores the value and tells the dashboard. The CSV marks those cells "to be verified"; this class records the real
 * behaviour. Route-level role checks are in AuthorizationMatrixTest; here the citizen cases assert the stored row stays as it was.
 */
class ReportLifecycleApiTest extends FlowTestBase {
    private static final String BASE = "/api/v1/community-reports";

    private int seed(UUID owner, String status) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.community_reports (user_id, client_report_id, location, description, status)
            VALUES (?, ?, ST_SetSRID(ST_MakePoint(104.5, 21.5), 4326), 'state test', CAST(? AS core_schema.report_status))
            RETURNING report_id
            """, Integer.class, owner, UUID.randomUUID(), status);
    }

    private String stored(int id) {
        return jdbc.queryForObject("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", String.class, id);
    }

    // ---- ST-RPT-001/003/007/008/013/014/015: an officer sets a status on a report in each state ----

    @ParameterizedTest(name = "report {0}, officer sets {1}: 200, stored {1}, dashboard told once [{2}]")
    @CsvSource({
        "submitted, submitted, ST-RPT-001",
        "submitted, archived,  ST-RPT-003",
        "processed, submitted, ST-RPT-007",
        "processed, processed, ST-RPT-008",
        "archived,  submitted, ST-RPT-013",
        "archived,  processed, ST-RPT-014",
        "archived,  archived,  ST-RPT-015"
    })
    void anOfficerCanSetAnyOfTheThreeStatusesOnAReportInAnyState(String from, String to, String ids) throws Exception {
        Acct officer = account("officer");
        int id = seed(account("citizen").id(), from);
        MvcResult stream = openStream();

        call(HttpMethod.PATCH, BASE + "/" + id + "/status", officer, Map.of("status", to))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reportId").value(id))
            .andExpect(jsonPath("$.status").value(to));

        assertThat(stored(id)).isEqualTo(to);
        assertThat(updates(stream)).containsExactly("field_reports");
        // the staff list shows the new status
        JsonNode listed = null;
        for (JsonNode r : read(call(HttpMethod.GET, BASE, officer, null).andExpect(status().isOk()))) {
            if (r.get("report_id").asInt() == id) listed = r;
        }
        assertThat(listed.get("status").asText()).isEqualTo(to);
    }

    // ---- ST-RPT-010/016: an unknown status on a processed or archived report ----

    @ParameterizedTest(name = "report {0}, officer sends unknown status: 400, nothing stored, nothing announced [{1}]")
    @CsvSource({"processed, ST-RPT-010", "archived, ST-RPT-016"})
    void anUnknownStatusIsRefusedOnAnyState(String from, String ids) throws Exception {
        Acct officer = account("officer");
        int id = seed(account("citizen").id(), from);
        MvcResult stream = openStream();

        call(HttpMethod.PATCH, BASE + "/" + id + "/status", officer, Map.of("status", "closed")).andExpect(status().isBadRequest());

        assertThat(stored(id)).isEqualTo(from);
        assertThat(updates(stream)).isEmpty();
    }

    // ---- ST-RPT-005/011/017: a citizen, even the owner, cannot change the status ----

    @ParameterizedTest(name = "report {0}, its owner tries to change it: 403, stored status kept, nothing announced [{1}]")
    @CsvSource({"submitted, ST-RPT-005", "processed, ST-RPT-011", "archived, ST-RPT-017"})
    void aCitizenCannotChangeAReportInAnyState(String from, String ids) throws Exception {
        Acct owner = account("citizen");
        int id = seed(owner.id(), from);
        MvcResult stream = openStream();

        call(HttpMethod.PATCH, BASE + "/" + id + "/status", owner, Map.of("status", from.equals("archived") ? "submitted" : "archived"))
            .andExpect(status().isForbidden());

        assertThat(stored(id)).isEqualTo(from);
        assertThat(updates(stream)).isEmpty();
    }

    // ---- ST-RPT-006/012/018: the owner reads the report again ----

    @ParameterizedTest(name = "report {0}: the owner's /mine shows it with that status and nobody else's list does [{1}]")
    @CsvSource({"submitted, ST-RPT-006", "processed, ST-RPT-012", "archived, ST-RPT-018"})
    void theOwnerSeesTheCurrentStatusOfTheirReportInEveryState(String state, String ids) throws Exception {
        Acct owner = account("citizen");
        Acct other = account("citizen");
        seed(owner.id(), state);

        call(HttpMethod.GET, BASE + "/mine", owner, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].status").value(state))
            .andExpect(jsonPath("$[0].description").value("state test"));
        call(HttpMethod.GET, BASE + "/mine", other, null).andExpect(jsonPath("$.length()").value(0));
    }
}
