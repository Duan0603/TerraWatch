package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pairwise table of who sees which forecast run (PW-FREV-001..015): availability x validity window x review state x viewer.
 * The web citizen reads GET /forecasts/active, the phone reads GET /forecasts/offline-sync, an officer reads
 * GET /forecasts/review-queue?status=all.
 * Where the CSV and the code differ (recorded, not a bug):
 * - there is no "revoked" review state: the enum is pending/approved/rejected/superseded. The only way to take an approved run
 *   away is to deactivate it (is_active = false); the rows with "revoked" use that. A deactivated run is hidden from the
 *   citizen feeds as the CSV says, and also from the officer queue, which the CSV does not say (PW-FREV-008).
 * - "not yet in force" is not a server rule for citizens: both citizen feeds filter on valid_until only, the phone gets
 *   validFrom and decides on the device (SRS 3.11). No row of the table puts an approved, available run in that cell.
 */
class ForecastVisibilityPairwiseApiTest extends FlowTestBase {

    private String unit() {
        String id = "PWF_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, id);
        return id;
    }

    private UUID run(String availability, String window, String review) {
        // window: upcoming (starts in 2 h), inforce, expired (ended 1 h ago)
        String from = switch (window) { case "upcoming" -> "2 hours"; case "expired" -> "-25 hours"; default -> "-1 hour"; };
        String until = switch (window) { case "upcoming" -> "26 hours"; case "expired" -> "-1 hour"; default -> "23 hours"; };
        boolean revoked = review.equals("revoked");
        boolean unavailable = availability.equals("unavailable");
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active, job_status, idempotency_key)
            VALUES (?, ?, now() - interval '30 minutes', now() + CAST(? AS interval), now() + CAST(? AS interval), ?, ?,
                CAST(? AS core_schema.risk_level), 'm', 't', CAST(? AS core_schema.forecast_review_status), ?, 'completed', ?)
            """, id, unit(), from, until, availability, unavailable ? null : 0.8, unavailable ? null : "high",
            revoked ? "approved" : review, !revoked, "pwf-" + id);
        return id;
    }

    @ParameterizedTest(name = "{0}: {1}, {2}, {3}, seen by {4}: listed {5}")
    @CsvSource({
        "PW-FREV-001, available,   upcoming, pending,    web,    false",
        "PW-FREV-002, available,   inforce,  approved,   mobile, true",
        "PW-FREV-003, available,   expired,  rejected,   staff,  true",
        "PW-FREV-004, unavailable, upcoming, approved,   staff,  true",
        "PW-FREV-005, unavailable, inforce,  rejected,   web,    false",
        "PW-FREV-006, unavailable, expired,  pending,    mobile, false",
        "PW-FREV-007, available,   upcoming, superseded, mobile, false",
        "PW-FREV-008, available,   inforce,  revoked,    staff,  false",
        "PW-FREV-009, unavailable, expired,  superseded, web,    false",
        "PW-FREV-010, unavailable, upcoming, revoked,    web,    false",
        "PW-FREV-011, available,   upcoming, rejected,   mobile, false",
        "PW-FREV-012, available,   inforce,  pending,    staff,  true",
        "PW-FREV-013, available,   inforce,  superseded, staff,  true",
        "PW-FREV-014, available,   expired,  approved,   web,    false",
        "PW-FREV-015, available,   expired,  revoked,    mobile, false"
    })
    void aRunIsListedOnlyWhereItsStateAllows(String id, String availability, String window, String review, String viewer, boolean listed) throws Exception {
        UUID run = run(availability, window, review);
        Acct citizen = account("citizen");
        Acct officer = account("officer");

        JsonNode found = null;
        JsonNode feed = switch (viewer) {
            case "web" -> read(call(HttpMethod.GET, "/api/v1/forecasts/active", citizen, null).andExpect(status().isOk()));
            case "mobile" -> read(call(HttpMethod.GET, "/api/v1/forecasts/offline-sync", citizen, null).andExpect(status().isOk())).get("items");
            default -> read(call(HttpMethod.GET, "/api/v1/forecasts/review-queue?status=all", officer, null).andExpect(status().isOk()));
        };
        for (JsonNode n : feed) if (n.get("runId").asText().equals(run.toString())) found = n;

        assertThat(found != null).as("%s listed for %s", id, viewer).isEqualTo(listed);
        if (found != null && viewer.equals("staff")) {
            // an officer sees the run with its labels; nothing is shown as safe: no hazard level is invented for an unavailable run
            assertThat(found.get("reviewStatus").asText()).isEqualTo(review);
            assertThat(found.get("availability").asText()).isEqualTo(availability);
            assertThat(found.get("expired").asBoolean()).isEqualTo(window.equals("expired"));
            if (availability.equals("unavailable")) {
                assertThat(found.get("hazardLevel").isNull()).isTrue();
                assertThat(found.get("probability").isNull()).isTrue();
            } else {
                assertThat(found.get("hazardLevel").asText()).isEqualTo("high");
            }
        }
        if (found != null && viewer.equals("mobile")) {
            assertThat(found.get("hazardLevel").asText()).isEqualTo("high");
            assertThat(found.get("validUntil").asText()).endsWith("Z");
        }
    }
}
