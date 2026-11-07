package vn.terrawatch.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vn.terrawatch.core.entity.ForecastRun;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ForecastRunJpaRepository extends JpaRepository<ForecastRun, UUID> {

    Optional<ForecastRun> findByIdempotencyKey(String idempotencyKey);

    /** Queue view: pending/running jobs. */
    @Query("SELECT f FROM ForecastRun f WHERE f.jobStatusRaw IN :statuses ORDER BY f.createdAt DESC")
    List<ForecastRun> findByJobStatusRawIn(List<String> statuses);

    /** Recovery: find jobs stuck in PENDING/RUNNING older than a cutoff. */
    @Query("SELECT f FROM ForecastRun f WHERE f.jobStatusRaw IN :statuses AND f.createdAt < :cutoff")
    List<ForecastRun> findStuckJobs(List<String> statuses, OffsetDateTime cutoff);

    /** True when the same unit already has a newer available forecast (the given run is superseded). */
    @Query("SELECT COUNT(f) > 0 FROM ForecastRun f WHERE f.unitId = :unitId AND f.runId <> :runId " +
           "AND f.issuedAt > :issuedAt AND f.availability = 'available' AND f.active = true")
    boolean existsNewer(String unitId, UUID runId, OffsetDateTime issuedAt);

    /** Active forecasts: approved, active, available, not expired. */
    @Query("SELECT f FROM ForecastRun f WHERE f.reviewStatus = 'approved' AND f.active = true " +
           "AND f.availability = 'available' AND f.validUntil > :now ORDER BY f.validUntil")
    List<ForecastRun> findActiveForecasts(OffsetDateTime now);
}
