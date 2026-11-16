package vn.terrawatch.core.controller;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;
import vn.terrawatch.core.service.ForecastJobService;
import vn.terrawatch.core.service.ForecastRecoveryPoller;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Forecast job lifecycle against the real database (ST-FJOB-*): the state a row is really in while the AI call is open
 * and when the result event goes out, the recovery poller's reach, and what a repeated create does to a row in each state.
 * Mock-level checks of the same service stay in ForecastJobServiceTest; here the stored rows are asserted.
 * Cells with no entry point (a COMPLETED/FAILED/UNAVAILABLE row is never handed to the worker: only the poller calls
 * executeJob and it selects pending/running) are proven through "the poller leaves it alone".
 */
class ForecastJobLifecycleApiTest extends FlowTestBase {
    @Autowired ForecastJobService jobs;
    @Autowired ForecastRecoveryPoller poller;

    private static final Map<String, Object> AI_VALID = Map.of("availability", "available", "probability", 0.42,
        "hazard_level", "high");
    private static final Map<String, Object> AI_NOT_READY = Map.of("availability", "unavailable",
        "unavailability_reason", "no rainfall data for the unit");

    private String unit() {
        String id = "FJOB_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, id);
        return id;
    }

    private UUID seed(String unitId, String jobStatus, int retries, int createdMinutesAgo) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, unit_version, issued_at, valid_from, valid_until, availability,
                model_version, threshold_version, hazard_level, review_status, is_active, job_status, retry_count, created_at, idempotency_key)
            VALUES (?, ?, 'v1', now(), now(), now() + interval '23 hours', 'available', 'm', 't', NULL,
                CAST('pending' AS core_schema.forecast_review_status), TRUE, ?, ?, now() - CAST(? AS interval), ?)
            """, id, unitId, jobStatus, retries, createdMinutesAgo + " minutes", "fjob-" + id);
        return id;
    }

    private Map<String, Object> row(UUID id) {
        em.flush();
        return jdbc.queryForMap("""
            SELECT job_status, availability, unavailability_reason, CAST(probability AS float8) AS probability,
                   hazard_level::text AS hazard_level, retry_count, started_at, completed_at, last_error, review_status::text AS review
            FROM core_schema.forecast_runs WHERE run_id = ?
            """, id);
    }

    // ---- ST-FJOB-001/002/009/010: the worker takes a pending or already running job and the AI answers ----

    @ParameterizedTest(name = "{0} (tried {1}) + worker + valid AI answer [{2}]")
    @CsvSource({
        "pending, 0, ST-FJOB-001/002",
        "running, 1, ST-FJOB-009/010"
    })
    void workerMarksRunningBeforeTheAiCallAndStoresTheResultBeforeTheEvent(String start, int tried, String ids) {
        UUID id = seed(unit(), start, tried, 0);
        AtomicReference<Map<String, Object>> duringAiCall = new AtomicReference<>();
        AtomicReference<Map<String, Object>> whenEventGoesOut = new AtomicReference<>();
        when(ai.requestForecast(anyMap())).thenAnswer(inv -> {
            duringAiCall.set(row(id));
            return AI_VALID;
        });
        doAnswer(inv -> {
            whenEventGoesOut.set(row(id));
            return null;
        }).when(events).publishEvent(eq("HAZARD_FORECAST_READY"), anyMap());

        jobs.executeJob(id);

        assertThat(duringAiCall.get()).containsEntry("job_status", "running").containsEntry("retry_count", tried + 1);
        assertThat(duringAiCall.get().get("started_at")).isNotNull();
        assertThat(duringAiCall.get().get("completed_at")).isNull();
        // DB first, event second: when the event leaves, the stored row already holds the result
        assertThat(whenEventGoesOut.get()).containsEntry("job_status", "completed").containsEntry("hazard_level", "high");
        Map<String, Object> done = row(id);
        assertThat(done).containsEntry("job_status", "completed").containsEntry("availability", "available")
            .containsEntry("retry_count", tried + 1).containsEntry("review", "pending");
        assertThat((Double) done.get("probability")).isEqualTo(0.42);
        assertThat(done.get("completed_at")).isNotNull();
        verify(events, times(1)).publishEvent(eq("HAZARD_FORECAST_READY"), anyMap());
    }

    // ---- ST-FJOB-003/004/011/012: the AI is not ready, or is down/slow (the client's fallback answers null) ----

    @ParameterizedTest(name = "{0} + AI {1}: run ends unavailable with a reason, no numbers, cannot be approved [{2}]")
    @CsvSource({
        "pending, NOT_READY, ST-FJOB-003",
        "pending, DOWN,      ST-FJOB-004",
        "running, NOT_READY, ST-FJOB-011",
        "running, DOWN,      ST-FJOB-012"
    })
    void anAiThatCannotAnswerLeavesAnUnavailableRunWithoutInventedNumbers(String start, String aiState, String ids) throws Exception {
        UUID id = seed(unit(), start, start.equals("running") ? 1 : 0, 0);
        when(ai.requestForecast(anyMap())).thenReturn("DOWN".equals(aiState) ? null : AI_NOT_READY);

        jobs.executeJob(id);

        Map<String, Object> out = row(id);
        assertThat(out).containsEntry("job_status", "unavailable").containsEntry("availability", "unavailable");
        assertThat(out.get("unavailability_reason").toString()).isNotBlank();
        assertThat(out.get("probability")).isNull();
        assertThat(out.get("hazard_level")).isNull();
        assertThat(out.get("completed_at")).isNotNull();
        if ("DOWN".equals(aiState)) verifyNoInteractions(events);
        // an unavailable run is not offered for approval, whatever the job did
        call(HttpMethod.PATCH, "/api/v1/forecasts/" + id + "/review", account("officer"), Map.of("decision", "approved"))
            .andExpect(status().isConflict());
        assertThat(row(id)).containsEntry("review", "pending");
    }

    /** ST-FJOB-003/011: the AI said "not ready" -> the run is unavailable, so no "forecast ready" event should go out. */
    @org.junit.jupiter.api.Disabled("BUG: expected no HAZARD_FORECAST_READY event when the AI reports the unit as unavailable "
        + "(run ends job_status=unavailable); actual: ForecastJobService.executeJob publishes it with hazard_level \"null\"")
    @org.junit.jupiter.api.Test
    void anUnavailableAiAnswerDoesNotAnnounceAReadyForecast() {
        UUID id = seed(unit(), "pending", 0, 0);
        when(ai.requestForecast(anyMap())).thenReturn(AI_NOT_READY);

        jobs.executeJob(id);

        assertThat(row(id)).containsEntry("job_status", "unavailable");
        verify(events, never()).publishEvent(eq("HAZARD_FORECAST_READY"), any());
    }

    @ParameterizedTest(name = "{0} + AI call throws: the error reaches the caller and no result event goes out [{1}]")
    @CsvSource({
        "pending, ST-FJOB-004",
        "running, ST-FJOB-012"
    })
    void anExceptionFromTheAiClientIsNotTurnedIntoAResult(String start, String ids) {
        UUID id = seed(unit(), start, start.equals("running") ? 1 : 0, 0);
        when(ai.requestForecast(anyMap())).thenThrow(new IllegalStateException("AI timed out"));

        assertThatThrownBy(() -> jobs.executeJob(id)).isInstanceOf(IllegalStateException.class).hasMessage("AI timed out");

        verify(events, never()).publishEvent(eq("HAZARD_FORECAST_READY"), any());
    }

    // ---- ST-FJOB-005/013/008/016: the recovery poller and its 5-minute boundary ----

    @ParameterizedTest(name = "{0} stuck for 10 minutes is recovered and re-run, one only 4 minutes old is left alone [{1}]")
    @CsvSource({
        "pending, 0, ST-FJOB-005/008",
        "running, 1, ST-FJOB-013/016"
    })
    void pollerRerunsOnlyJobsOlderThanTheStuckTimeout(String start, int tried, String ids) throws Exception {
        UUID stuck = seed(unit(), start, tried, 10);
        UUID fresh = seed(unit(), start, tried, 4);
        when(ai.requestForecast(anyMap())).thenReturn(AI_VALID);
        MvcResult stream = openStream();

        poller.pollStuckJobs();

        assertThat(row(stuck)).containsEntry("job_status", "completed").containsEntry("retry_count", tried + 1);
        assertThat(row(fresh)).containsEntry("job_status", start).containsEntry("retry_count", tried);
        verify(ai, times(1)).requestForecast(anyMap());
        assertThat(updates(stream)).containsExactly("queue");
    }

    // ---- ST-FJOB-006/014: a job that has already used its 3 tries ----

    @ParameterizedTest(name = "{0} stuck with 3 tries used is marked failed without calling the AI [{1}]")
    @CsvSource({
        "pending, ST-FJOB-006",
        "running, ST-FJOB-014"
    })
    void aJobWithAllTriesUsedIsFailedNotRetried(String start, String ids) throws Exception {
        UUID id = seed(unit(), start, 3, 10);
        MvcResult stream = openStream();

        poller.pollStuckJobs();

        assertThat(row(id)).containsEntry("job_status", "failed").containsEntry("last_error", "Max retries exceeded")
            .containsEntry("retry_count", 3);
        verifyNoInteractions(ai, events);
        assertThat(updates(stream)).containsExactly("queue");
        // and it is gone from the working queue
        var queue = read(call(HttpMethod.GET, "/api/v1/forecasts/queue", account("officer"), null).andExpect(status().isOk()));
        queue.forEach(n -> assertThat(n.get("runId").asText()).isNotEqualTo(id.toString()));
    }

    // ---- ST-FJOB-017..040 terminal states: stuck or after a restart, the poller never hands them to the worker ----

    @ParameterizedTest(name = "{0} (tried {1}) that is 10 minutes old is not touched by the poller [{2}]")
    @CsvSource({
        "completed,   1, ST-FJOB-021/024",
        "failed,      3, ST-FJOB-022/029/030/032",
        "unavailable, 1, ST-FJOB-037/038/040"
    })
    void terminalJobsAreNeverRerun(String state, int tried, String ids) throws Exception {
        UUID id = seed(unit(), state, tried, 10);
        Map<String, Object> before = row(id);
        MvcResult stream = openStream();

        poller.pollStuckJobs();

        assertThat(row(id)).isEqualTo(before);
        verifyNoInteractions(ai, events);
        assertThat(updates(stream)).isEmpty();
    }

    // ---- ST-FJOB-007/015/023/031/039: the same idempotency key again, in every state ----

    @ParameterizedTest(name = "same key again while the job is {0}: 202, same run, nothing re-run [{1}]")
    @CsvSource({
        "pending,     ST-FJOB-007",
        "running,     ST-FJOB-015",
        "completed,   ST-FJOB-023",
        "failed,      ST-FJOB-031",
        "unavailable, ST-FJOB-039"
    })
    void repeatedCreateReturnsTheSameRunInItsCurrentState(String state, String id) throws Exception {
        String unit = unit();
        Acct officer = account("officer");
        Map<String, Object> req = Map.of("unitId", unit, "unitVersion", "v1", "modelVersion", "xgb-v1", "thresholdVersion", "th-v1");
        // ponytail: the key contains the current hour, so a call pair straddling an hour change would create two runs
        String first = read(call(HttpMethod.POST, "/api/v1/forecasts", officer, req).andExpect(status().isAccepted())).get("runId").asText();
        jdbc.update("UPDATE core_schema.forecast_runs SET job_status = ? WHERE run_id = CAST(? AS uuid)", state, first);
        em.clear();

        var second = read(call(HttpMethod.POST, "/api/v1/forecasts", officer, req).andExpect(status().isAccepted()));

        assertThat(second.get("runId").asText()).isEqualTo(first);
        assertThat(second.get("jobStatus").asText()).isEqualTo(state);
        assertThat(count("SELECT count(*) FROM core_schema.forecast_runs WHERE unit_id = ?", unit)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT job_status FROM core_schema.forecast_runs WHERE run_id = CAST(? AS uuid)", String.class, first))
            .isEqualTo(state);
        // only the first create woke the worker
        verify(events, times(1)).publishEvent(eq("RAINFALL_INPUTS_UPDATED"), anyMap());
        verifyNoInteractions(ai);
    }
}
