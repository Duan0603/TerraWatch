package vn.terrawatch.core.controller;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import vn.terrawatch.core.service.ForecastRecoveryPoller;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Recovery boundaries (BL-FJOB-001..004) on the real database: a job is recovered once it has been idle longer than 5 minutes
 * (second-level edges, 4:59 and 5:01) and while it still has tries left (the 3rd try runs, the 4th never starts).
 * ForecastJobLifecycleApiTest asserts the same rules with 4 and 10 minutes and with the failed outcome of a job with all 3 tries
 * used (BL-FJOB-004 = ST-FJOB-006/014, already covered); this class pins the exact edges.
 */
class ForecastRecoveryBoundaryApiTest extends FlowTestBase {
    @Autowired ForecastRecoveryPoller poller;

    private UUID seed(String status, int retries, String age) {
        String unit = "FJOBB_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, unit);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, unit_version, issued_at, valid_from, valid_until, availability,
                model_version, threshold_version, hazard_level, review_status, is_active, job_status, retry_count, created_at, idempotency_key)
            VALUES (?, ?, 'v1', now(), now(), now() + interval '23 hours', 'available', 'm', 't', NULL,
                CAST('pending' AS core_schema.forecast_review_status), TRUE, ?, ?, now() - CAST(? AS interval), ?)
            """, id, unit, status, retries, age, "fjobb-" + id);
        return id;
    }

    private Map<String, Object> row(UUID id) {
        em.flush();
        return jdbc.queryForMap("SELECT job_status, retry_count, last_error FROM core_schema.forecast_runs WHERE run_id = ?", id);
    }

    // ---- BL-FJOB-001/002: idle 4 min 59 s is left alone, 5 min 1 s is recovered ----

    @ParameterizedTest(name = "{0} job idle {1}: recovered={2} [{3}]")
    @CsvSource({
        "pending, '4 minutes 59 seconds', false, BL-FJOB-001",
        "pending, '5 minutes 1 second',   true,  BL-FJOB-002",
        "running, '4 minutes 59 seconds', false, BL-FJOB-001",
        "running, '5 minutes 1 second',   true,  BL-FJOB-002"
    })
    void aJobIsRecoveredOnlyAfterFiveMinutesOfIdleness(String status, String age, boolean recovered, String ids) {
        UUID id = seed(status, 1, age);
        when(ai.requestForecast(anyMap())).thenReturn(Map.of("availability", "available", "probability", 0.3, "hazard_level", "low"));

        poller.pollStuckJobs();

        if (recovered) {
            assertThat(row(id)).containsEntry("job_status", "completed").containsEntry("retry_count", 2);
            verify(ai, times(1)).requestForecast(anyMap());
        } else {
            assertThat(row(id)).containsEntry("job_status", status).containsEntry("retry_count", 1);
            verify(ai, never()).requestForecast(anyMap());
        }
    }

    // ---- BL-FJOB-003: the third try still runs ----

    @ParameterizedTest(name = "{0} job with 2 tries used gets its 3rd try and is then completed, not failed [BL-FJOB-003]")
    @CsvSource({"pending", "running"})
    void theThirdTryIsStillMadeAndCountedAsThree(String status) {
        UUID id = seed(status, 2, "10 minutes");
        when(ai.requestForecast(anyMap())).thenReturn(Map.of("availability", "available", "probability", 0.3, "hazard_level", "low"));

        poller.pollStuckJobs();

        assertThat(row(id)).containsEntry("job_status", "completed").containsEntry("retry_count", 3);
        assertThat(row(id).get("last_error")).isNull();
        verify(ai, times(1)).requestForecast(anyMap());
    }
}
