package vn.terrawatch.core.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.terrawatch.core.entity.ForecastRun;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Custom queries of {@link ForecastRunJpaRepository}. Rows are inserted with SQL, then read through the repository. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ForecastRunJpaRepositoryDbTest {
    private static final OffsetDateTime NOW = OffsetDateTime.parse("2030-06-15T12:00:00Z");

    @Autowired ForecastRunJpaRepository runs;
    @Autowired JdbcTemplate jdbc;
    private final Set<UUID> mine = new HashSet<>();
    private final String unitId = "DBTEST-" + UUID.randomUUID().toString().substring(0, 8);
    private boolean unitCreated;

    private void ensureUnit(String id) {
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'P', 'D', ST_GeomFromText('POLYGON((106 10, 106.01 10, 106.01 10.01, 106 10.01, 106 10))', 4326))
            ON CONFLICT DO NOTHING
            """, id);
    }

    /** Builder-ish helper: one forecast_runs row with the knobs these queries filter on. */
    private UUID run(String unit, String jobStatus, OffsetDateTime createdAt, OffsetDateTime issuedAt, OffsetDateTime validUntil,
                     String review, boolean active, String availability, String idempotencyKey) {
        ensureUnit(unit);
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, model_version, threshold_version,
                review_status, is_active, availability, job_status, idempotency_key, created_at)
            VALUES (?, ?, ?, ?, ?, 'm1', 't1', CAST(? AS core_schema.forecast_review_status), ?, ?, ?, ?, ?)
            """, id, unit, issuedAt, issuedAt, validUntil, review, active, availability, jobStatus, idempotencyKey, createdAt);
        mine.add(id);
        return id;
    }

    private UUID simple(String jobStatus, OffsetDateTime createdAt) {
        return run(unitId, jobStatus, createdAt, NOW.minusDays(1), NOW.plusDays(1), "pending", true, "available", null);
    }

    private List<UUID> onlyMine(List<ForecastRun> found) {
        return found.stream().map(ForecastRun::getRunId).filter(mine::contains).toList();
    }

    // ---- findByIdempotencyKey ----

    @Test
    void findByIdempotencyKeyReturnsTheMatchingRunOrEmpty() {
        String key = "key-" + UUID.randomUUID();
        UUID id = run(unitId, "pending", NOW, NOW, NOW.plusDays(1), "pending", true, "available", key);
        run(unitId, "pending", NOW, NOW, NOW.plusDays(1), "pending", true, "available", "other-" + key);

        assertThat(runs.findByIdempotencyKey(key)).get().extracting(ForecastRun::getRunId).isEqualTo(id);
        assertThat(runs.findByIdempotencyKey(key.toUpperCase())).as("keys are case sensitive").isEmpty();
        assertThat(runs.findByIdempotencyKey("missing-" + key)).isEmpty();
    }

    // ---- findByJobStatusRawIn ----

    @Test
    void findByJobStatusRawInFiltersByTheGivenStatusesNewestCreatedFirst() {
        UUID pendingOld = simple("pending", NOW.minusHours(3));
        UUID runningNew = simple("running", NOW.minusHours(1));
        UUID pendingMid = simple("pending", NOW.minusHours(2));
        simple("completed", NOW);
        simple("failed", NOW);

        assertThat(onlyMine(runs.findByJobStatusRawIn(List.of("pending", "running")))).containsExactly(runningNew, pendingMid, pendingOld);
        assertThat(onlyMine(runs.findByJobStatusRawIn(List.of("running")))).containsExactly(runningNew);
        assertThat(onlyMine(runs.findByJobStatusRawIn(List.of("unavailable")))).isEmpty();
    }

    // ---- findStuckJobs ----

    @Test
    void findStuckJobsIsStrictlyOlderThanTheCutoffAndLimitedToTheGivenStatuses() {
        OffsetDateTime cutoff = NOW.minusMinutes(5);
        UUID justOlder = simple("pending", cutoff.minusNanos(1_000));
        UUID veryOld = simple("running", cutoff.minusDays(2));
        simple("pending", cutoff);                         // exactly at the cutoff: not stuck yet
        simple("pending", cutoff.plusNanos(1_000));        // just inside the window
        simple("completed", cutoff.minusDays(2));          // old but finished
        simple("failed", cutoff.minusDays(2));

        assertThat(onlyMine(runs.findStuckJobs(List.of("pending", "running"), cutoff))).containsExactlyInAnyOrder(justOlder, veryOld);
        assertThat(onlyMine(runs.findStuckJobs(List.of("running"), cutoff))).containsExactly(veryOld);
        assertThat(onlyMine(runs.findStuckJobs(List.of("pending", "running"), cutoff.minusYears(1)))).isEmpty();
    }

    // ---- existsNewer ----

    @Test
    void existsNewerIsTrueOnlyForAStrictlyLaterAvailableActiveRunOfTheSameUnit() {
        OffsetDateTime issued = NOW.minusHours(6);
        UUID subject = run(unitId, "completed", NOW, issued, NOW.plusDays(1), "approved", true, "available", null);
        assertThat(runs.existsNewer(unitId, subject, issued)).as("alone").isFalse();

        String otherUnit = unitId + "-B";
        run(otherUnit, "completed", NOW, issued.plusHours(1), NOW.plusDays(1), "approved", true, "available", null);
        run(unitId, "completed", NOW, issued, NOW.plusDays(1), "approved", true, "available", null);                     // same instant: not newer
        run(unitId, "completed", NOW, issued.minusHours(1), NOW.plusDays(1), "approved", true, "available", null);       // older
        run(unitId, "completed", NOW, issued.plusHours(1), NOW.plusDays(1), "approved", false, "available", null);       // inactive
        run(unitId, "completed", NOW, issued.plusHours(1), NOW.plusDays(1), "approved", true, "unavailable", null);      // unavailable
        assertThat(runs.existsNewer(unitId, subject, issued)).as("only non-qualifying neighbours").isFalse();

        run(unitId, "completed", NOW, issued.plusNanos(1_000), NOW.plusDays(1), "pending", true, "available", null);     // 1 microsecond later qualifies
        assertThat(runs.existsNewer(unitId, subject, issued)).isTrue();
    }

    @Test
    void existsNewerDoesNotCountTheRunItself() {
        OffsetDateTime issued = NOW.minusHours(6);
        UUID later = run(unitId, "completed", NOW, issued.plusHours(1), NOW.plusDays(1), "approved", true, "available", null);
        // Asked about the later run itself with an older timestamp: it must not supersede itself.
        assertThat(runs.existsNewer(unitId, later, issued)).isFalse();
    }

    // ---- findActiveForecasts ----

    @Test
    void findActiveForecastsNeedsApprovedActiveAvailableAndNotYetExpiredSortedByExpiry() {
        UUID soon = run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(1), "approved", true, "available", null);
        UUID later = run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(9), "approved", true, "available", null);
        UUID middle = run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(5), "approved", true, "available", null);
        run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(2), "pending", true, "available", null);
        run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(2), "rejected", true, "available", null);
        run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(2), "superseded", true, "available", null);
        run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(2), "approved", false, "available", null);
        run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(2), "approved", true, "unavailable", null);

        assertThat(onlyMine(runs.findActiveForecasts(NOW))).containsExactly(soon, middle, later);
    }

    @Test
    void findActiveForecastsTreatsValidUntilAsExclusive() {
        UUID id = run(unitId, "completed", NOW, NOW.minusDays(1), NOW.plusHours(1), "approved", true, "available", null);

        assertThat(onlyMine(runs.findActiveForecasts(NOW.plusHours(1).minusNanos(1_000)))).containsExactly(id);
        assertThat(onlyMine(runs.findActiveForecasts(NOW.plusHours(1)))).as("valid_until == now is already expired").isEmpty();
        assertThat(onlyMine(runs.findActiveForecasts(NOW.plusHours(1).plusNanos(1_000)))).isEmpty();
    }
}
