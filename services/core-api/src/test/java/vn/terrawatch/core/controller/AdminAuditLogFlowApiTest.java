package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import vn.terrawatch.core.service.AdminAuditService;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The audit log read side: clamping, ordering, field shape, and what a row looks like for an unknown actor. */
class AdminAuditLogFlowApiTest extends FlowTestBase {
    private static final String AUDIT = "/api/v1/admin/audit";

    @Autowired AdminAuditService audit;

    private void insertRows(int rows, String action) {
        jdbc.update("INSERT INTO core_schema.admin_audit (action, created_at) SELECT ?, now() + (g || ' seconds')::interval FROM generate_series(1, ?) g", action, rows);
    }

    @Test
    void limitBelowOneIsRaisedToOneAndAbove500IsCutTo500() throws Exception {
        Acct admin = account("admin");
        insertRows(505, "FLOW_BULK");

        for (String limit : new String[]{"0", "-5"}) {
            assertThat(read(call(HttpMethod.GET, AUDIT + "?limit=" + limit, admin, null).andExpect(status().isOk()))).hasSize(1);
        }
        assertThat(read(call(HttpMethod.GET, AUDIT + "?limit=500", admin, null))).hasSize(500);
        assertThat(read(call(HttpMethod.GET, AUDIT + "?limit=2147483647", admin, null))).hasSize(500);
        assertThat(read(call(HttpMethod.GET, AUDIT + "?limit=3", admin, null))).hasSize(3);
    }

    @Test
    void withoutALimitTheLatest200RowsAreReturnedNewestFirst() throws Exception {
        Acct admin = account("admin");
        insertRows(205, "FLOW_DEFAULT");

        JsonNode rows = read(call(HttpMethod.GET, AUDIT, admin, null).andExpect(status().isOk()));

        assertThat(rows).hasSize(200);
        for (int i = 1; i < rows.size(); i++) {
            assertThat(rows.get(i - 1).get("at").asText()).isGreaterThanOrEqualTo(rows.get(i).get("at").asText());
        }
    }

    @Test
    void rowsWithTheSameTimestampComeBackHighestIdFirst() throws Exception {
        Acct admin = account("admin");
        jdbc.update("INSERT INTO core_schema.admin_audit (action, created_at) VALUES ('FLOW_TIE_A', now() + interval '1 day'), ('FLOW_TIE_B', now() + interval '1 day')");

        JsonNode rows = read(call(HttpMethod.GET, AUDIT + "?limit=2", admin, null));

        assertThat(rows.get(0).get("action").asText()).isEqualTo("FLOW_TIE_B");
        assertThat(rows.get(1).get("action").asText()).isEqualTo("FLOW_TIE_A");
        assertThat(rows.get(0).get("id").asLong()).isGreaterThan(rows.get(1).get("id").asLong());
    }

    @Test
    void recordFillsTheActorEmailFromTheUserAndKeepsEveryFieldInTheListing() throws Exception {
        Acct admin = account("admin");
        audit.record(admin.id(), "FLOW_RECORD", "user", "target-1", "Target Label", "k=v");
        em.flush();

        JsonNode row = read(call(HttpMethod.GET, AUDIT + "?limit=1", admin, null)).get(0);

        assertThat(row.get("action").asText()).isEqualTo("FLOW_RECORD");
        assertThat(row.get("actor").asText()).isEqualTo(admin.user().getEmail());
        assertThat(row.get("targetType").asText()).isEqualTo("user");
        assertThat(row.get("targetId").asText()).isEqualTo("target-1");
        assertThat(row.get("targetLabel").asText()).isEqualTo("Target Label");
        assertThat(row.get("detail").asText()).isEqualTo("k=v");
        assertThat(java.time.Instant.parse(row.get("at").asText())).isBeforeOrEqualTo(java.time.Instant.now());
    }

    @Test
    void anActorWhoNoLongerExistsStillLeavesARowWithNoEmailAndNullOptionalFields() throws Exception {
        Acct admin = account("admin");
        audit.record(UUID.randomUUID(), "FLOW_GHOST", "broadcast", null, null, null);
        em.flush();

        JsonNode row = read(call(HttpMethod.GET, AUDIT + "?limit=1", admin, null)).get(0);

        assertThat(row.get("action").asText()).isEqualTo("FLOW_GHOST");
        assertThat(row.get("actor").isNull()).isTrue();
        assertThat(row.get("targetId").isNull()).isTrue();
        assertThat(row.get("targetLabel").isNull()).isTrue();
        assertThat(row.get("detail").isNull()).isTrue();
    }
}
