package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Decision table of the forecast proposal lifecycle (ST-FREV-*): which review decisions each state accepts, what a
 * refused decision leaves behind, and where a proposal in each state is visible. Cases that older tests already assert
 * (ST-FREV-001, 003, 005, 006, 007, 012, 013, 020, 023) are not repeated here.
 */
class ForecastReviewLifecycleApiTest extends FlowTestBase {

    /** One row of the state axis: review_status, validity window relative to now, availability. */
    enum State {
        PENDING_LIVE("pending", "23 hours", "available"),
        PENDING_EXPIRED("pending", "-6 hours", "available"),
        PENDING_UNAVAILABLE("pending", "23 hours", "unavailable"),
        APPROVED("approved", "23 hours", "available"),
        APPROVED_EXPIRED("approved", "-6 hours", "available"),
        REJECTED("rejected", "23 hours", "available"),
        SUPERSEDED("superseded", "23 hours", "available");

        final String review, validUntil, availability;

        State(String review, String validUntil, String availability) {
            this.review = review;
            this.validUntil = validUntil;
            this.availability = availability;
        }
    }

    private UUID seedRun(String unitId, State s, String issuedOffset) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active, job_status, idempotency_key)
            VALUES (?, ?, now() + CAST(? AS interval), now() - interval '30 hours', now() + CAST(? AS interval), ?, 0.8, 'high',
                'm', 't', CAST(? AS core_schema.forecast_review_status), TRUE, 'completed', ?)
            """, id, unitId, issuedOffset, s.validUntil, s.availability, s.review, "frev-" + id);
        return id;
    }

    private String newUnit() {
        String id = "FREV_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, id);
        return id;
    }

    private UUID run(State s) { return seedRun(newUnit(), s, "-1 hour"); }

    private String reviewStatus(UUID id) {
        return jdbc.queryForObject("SELECT review_status::text FROM core_schema.forecast_runs WHERE run_id = ?", String.class, id);
    }

    private long reviewRows(UUID id) {
        return count("SELECT count(*) FROM core_schema.forecast_reviews WHERE run_id = ?", id);
    }

    private Set<String> ids(JsonNode array, String field) {
        Set<String> out = new HashSet<>();
        array.forEach(n -> out.add(n.get(field).asText()));
        return out;
    }

    // ---- ST-FREV-002/008/009/014/015/019/021/025/026/027/031/032/033: events x states ----

    @ParameterizedTest(name = "{0} + {1} -> HTTP {2}, run ends {3} [{4}]")
    @CsvSource({
        "PENDING_LIVE,        REJECT_WITH_REASON,    200, rejected,   ST-FREV-002",
        "PENDING_EXPIRED,     REJECT_WITH_REASON,    409, pending,    ST-FREV-008",
        "PENDING_EXPIRED,     REJECT_WITHOUT_REASON, 409, pending,    ST-FREV-009",
        "PENDING_UNAVAILABLE, REJECT_WITH_REASON,    200, rejected,   ST-FREV-014",
        "PENDING_UNAVAILABLE, REJECT_WITHOUT_REASON, 400, pending,    ST-FREV-015",
        "APPROVED,            APPROVE,               409, approved,   ST-FREV-019",
        "APPROVED,            REJECT_WITHOUT_REASON, 409, approved,   ST-FREV-021",
        "REJECTED,            APPROVE,               409, rejected,   ST-FREV-025",
        "REJECTED,            REJECT_WITH_REASON,    409, rejected,   ST-FREV-026",
        "REJECTED,            REJECT_WITHOUT_REASON, 409, rejected,   ST-FREV-027",
        "SUPERSEDED,          APPROVE,               409, superseded, ST-FREV-031",
        "SUPERSEDED,          REJECT_WITH_REASON,    409, superseded, ST-FREV-032",
        "SUPERSEDED,          REJECT_WITHOUT_REASON, 409, superseded, ST-FREV-033"
    })
    void reviewDecisionTable(State state, Event event, int httpStatus, String statusAfter, String conditionId) throws Exception {
        UUID run = run(state);
        Acct officer = account("officer");
        MvcResult stream = openStream();

        call(HttpMethod.PATCH, "/api/v1/forecasts/" + run + "/review", officer, event.body())
            .andExpect(status().is(httpStatus));

        assertThat(reviewStatus(run)).isEqualTo(statusAfter);
        if (httpStatus == 200) {
            assertThat(reviewRows(run)).isEqualTo(1);
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT decision::text AS decision, reviewer_id, reason_notes FROM core_schema.forecast_reviews WHERE run_id = ?", run);
            assertThat(row.get("decision")).isEqualTo("rejected");
            assertThat(row.get("reviewer_id")).isEqualTo(officer.id());
            assertThat(row.get("reason_notes")).isEqualTo(Event.REASON);
            verify(events).publishEvent("FORECAST_REVIEWED",
                Map.of("run_id", run.toString(), "decision", "rejected", "reviewer_id", officer.id().toString()));
            assertThat(updates(stream)).containsExactly("queue");
        } else {
            // a refused decision leaves no review record, no event and no live update
            assertThat(reviewRows(run)).isZero();
            verify(events, never()).publishEvent(eq("FORECAST_REVIEWED"), any());
            assertThat(updates(stream)).isEmpty();
        }
    }

    enum Event {
        APPROVE(Map.of("decision", "approved")),
        REJECT_WITH_REASON(Map.of("decision", "rejected", "reasonNotes", Event.REASON)),
        REJECT_WITHOUT_REASON(Map.of("decision", "rejected"));

        static final String REASON = "Rain gauge reading contradicts the model";
        private final Map<String, Object> body;

        Event(Map<String, Object> body) { this.body = body; }

        Map<String, Object> body() { return body; }
    }

    // ---- ST-FREV-031/032/033 (derived): a pending run that a newer available run of the same unit replaced ----

    @ParameterizedTest(name = "pending run with a newer run of the same unit + {0} -> 409")
    @EnumSource(value = Event.class, names = {"APPROVE", "REJECT_WITH_REASON"})
    void aPendingRunThatANewerRunReplacedCannotBeReviewed(Event event) throws Exception {
        String unit = newUnit();
        UUID older = seedRun(unit, State.PENDING_LIVE, "-2 hours");
        UUID newer = seedRun(unit, State.PENDING_LIVE, "-1 hour");
        Acct officer = account("officer");

        call(HttpMethod.PATCH, "/api/v1/forecasts/" + older + "/review", officer, event.body())
            .andExpect(status().isConflict());

        assertThat(reviewStatus(older)).isEqualTo("pending");
        assertThat(reviewRows(older)).isZero();
        verifyNoInteractions(events);
        // the newer run is still reviewable
        call(HttpMethod.PATCH, "/api/v1/forecasts/" + newer + "/review", officer, Event.APPROVE.body()).andExpect(status().isOk());
        assertThat(reviewStatus(newer)).isEqualTo("approved");
    }

    // ---- ST-FREV-004/010/016/022/028/034: who sees what on the citizen's active list ----

    @ParameterizedTest(name = "{0} -> on the active list: {1}")
    @CsvSource({
        "PENDING_LIVE,        false",   // ST-FREV-004
        "PENDING_EXPIRED,     false",   // ST-FREV-010
        "PENDING_UNAVAILABLE, false",   // ST-FREV-016
        "APPROVED,            true",    // ST-FREV-022
        "APPROVED_EXPIRED,    false",   // ST-FREV-022 (until it expires)
        "REJECTED,            false",   // ST-FREV-028
        "SUPERSEDED,          false"    // ST-FREV-034
    })
    void activeListShowsOnlyApprovedAvailableUnexpiredRuns(State state, boolean listed) throws Exception {
        UUID run = run(state);
        Acct citizen = account("citizen");

        JsonNode active = read(call(HttpMethod.GET, "/api/v1/forecasts/active", citizen, null).andExpect(status().isOk()));

        assertThat(ids(active, "runId").contains(run.toString())).isEqualTo(listed);
    }

    // ---- ST-FREV-011/017/029/035: a broadcast may only cite an approved, available, unexpired run ----

    @ParameterizedTest(name = "{0} cannot be cited by a broadcast")
    @EnumSource(value = State.class, names = {"PENDING_EXPIRED", "PENDING_UNAVAILABLE", "REJECTED", "SUPERSEDED"})
    void broadcastCannotCiteARunThatIsNotApproved(State state) throws Exception {
        UUID run = run(state);
        Acct admin = account("admin");
        long broadcastsBefore = count("SELECT count(*) FROM core_schema.alert_broadcasts");

        call(HttpMethod.POST, "/api/v1/notifications/broadcast", admin,
            Map.of("riskLevel", "high", "areaId", seedArea(), "runId", run.toString()))
            .andExpect(status().isConflict());

        assertThat(count("SELECT count(*) FROM core_schema.alert_broadcasts")).isEqualTo(broadcastsBefore);
        verifyNoInteractions(fcm, sms);
    }

    // ---- ST-FREV-018/024/030/036 (+012 membership): which review-queue filter shows a run in each state ----

    @ParameterizedTest(name = "{0} -> queue pending={1} approved={2} rejected={3} all={4}")
    @CsvSource({
        "PENDING_UNAVAILABLE, true,  false, false, true",    // ST-FREV-018
        "APPROVED,            false, true,  false, true",    // ST-FREV-024
        "REJECTED,            false, false, true,  true",    // ST-FREV-030
        "SUPERSEDED,          false, false, false, true"     // ST-FREV-036 (recorded behaviour: only the "all" view lists it)
    })
    void reviewQueueFilterShowsARunOnlyInTheViewsThatMatchItsState(State state, boolean inPending, boolean inApproved,
                                                                   boolean inRejected, boolean inAll) throws Exception {
        UUID run = run(state);
        Acct officer = account("officer");
        Map<String, Boolean> expected = Map.of("pending", inPending, "approved", inApproved, "rejected", inRejected, "all", inAll);

        expected.forEach((filter, shown) -> {
            try {
                JsonNode queue = read(call(HttpMethod.GET, "/api/v1/forecasts/review-queue?status=" + filter, officer, null)
                    .andExpect(status().isOk()));
                assertThat(ids(queue, "runId").contains(run.toString()))
                    .as("queue status=%s shows %s", filter, state).isEqualTo(shown);
            } catch (Exception e) {
                throw new AssertionError(e);
            }
        });
    }
}
