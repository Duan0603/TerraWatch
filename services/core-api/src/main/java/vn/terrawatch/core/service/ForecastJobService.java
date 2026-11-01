package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.entity.ForecastRun;
import vn.terrawatch.core.entity.ForecastRun.JobStatus;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.ForecastRunJpaRepository;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Story 4.1: Persisted forecast job orchestration.
 * DB-first, event-second. Never fabricate forecasts.
 */
@Service
public class ForecastJobService {

    private static final Logger log = LoggerFactory.getLogger(ForecastJobService.class);

    private final ForecastRunJpaRepository repo;
    private final AiServiceClient aiClient;
    private final EventPublisher events;

    public ForecastJobService(ForecastRunJpaRepository repo, AiServiceClient aiClient, EventPublisher events) {
        this.repo = repo;
        this.aiClient = aiClient;
        this.events = events;
    }

    /**
     * Create a forecast job. Idempotent: same key returns existing run.
     * @return the persisted ForecastRun (PENDING or existing)
     */
    @Transactional
    public ForecastRun createJob(String unitId, String unitVersion, UUID snapshotId,
                                 String modelVersion, String thresholdVersion) {
        var run = new ForecastRun();
        run.setUnitId(unitId);
        run.setUnitVersion(unitVersion);
        run.setSnapshotId(snapshotId);
        run.setModelVersion(modelVersion);
        run.setThresholdVersion(thresholdVersion);
        run.setIssuedAt(OffsetDateTime.now());
        run.setValidFrom(OffsetDateTime.now());
        run.setValidUntil(OffsetDateTime.now().plusHours(24));
        run.generateIdempotencyKey();

        // Idempotency check
        Optional<ForecastRun> existing = repo.findByIdempotencyKey(run.getIdempotencyKey());
        if (existing.isPresent()) {
            log.info("Idempotent hit: returning existing run {} for key {}", existing.get().getRunId(), run.getIdempotencyKey());
            return existing.get();
        }

        run.setJobStatus(JobStatus.PENDING);
        ForecastRun saved = repo.save(run);
        log.info("Created forecast job {} for unit {} (PENDING)", saved.getRunId(), unitId);

        // Optional Redis wakeup — non-fatal
        try {
            events.publishEvent("RAINFALL_INPUTS_UPDATED", Map.of("run_id", saved.getRunId().toString(), "unit_id", unitId));
        } catch (Exception e) {
            log.warn("Redis notification failed (non-fatal): {}", e.getMessage());
        }

        return saved;
    }

    /**
     * Execute a pending/failed forecast job: call AI, persist result, then notify.
     * DB-first, event-second. Never fabricate.
     */
    @Transactional
    public ForecastRun executeJob(UUID runId) {
        ForecastRun run = repo.findById(runId).orElseThrow(() ->
                new IllegalArgumentException("Forecast run not found: " + runId));

        if (run.getJobStatus() == JobStatus.COMPLETED) {
            log.info("Job {} already completed, skipping", runId);
            return run;
        }

        if (run.getRetryCount() >= run.getMaxRetries()) {
            log.warn("Job {} exceeded max retries ({}), marking FAILED", runId, run.getMaxRetries());
            run.setJobStatus(JobStatus.FAILED);
            run.setLastError("Max retries exceeded");
            return repo.save(run);
        }

        // Mark RUNNING
        run.setJobStatus(JobStatus.RUNNING);
        run.setStartedAt(OffsetDateTime.now());
        run.setRetryCount(run.getRetryCount() + 1);
        repo.save(run);

        // Call AI service
        Map<String, Object> aiRequest = Map.of(
                "schema_version", "rainfall-terrain-24h.v1",
                "snapshot_id", run.getSnapshotId() != null ? run.getSnapshotId().toString() : "",
                "assessment_unit_id", run.getUnitId(),
                "assessment_unit_version", run.getUnitVersion(),
                "issued_at", run.getIssuedAt().toString(),
                "horizon_hours", run.getHorizonHours(),
                "model_version", run.getModelVersion()
        );

        Map<String, Object> aiResult = aiClient.requestForecast(aiRequest);

        if (aiResult == null) {
            // AI unavailable — persist unavailable, do NOT fabricate
            run.setJobStatus(JobStatus.UNAVAILABLE);
            run.setAvailability("unavailable");
            run.setUnavailabilityReason("AI service unavailable (circuit breaker)");
            run.setCompletedAt(OffsetDateTime.now());
            ForecastRun saved = repo.save(run);
            log.warn("Job {} marked UNAVAILABLE: AI service down", runId);
            return saved;
        }

        // Persist AI result BEFORE notification
        run.setJobStatus(JobStatus.COMPLETED);
        run.setCompletedAt(OffsetDateTime.now());
        run.setAvailability(String.valueOf(aiResult.getOrDefault("availability", "available")));
        if (aiResult.get("probability") instanceof Number n) run.setProbability(n.doubleValue());
        if (aiResult.get("experimental_score") instanceof Number n) run.setExperimentalScore(n.doubleValue());
        if (aiResult.get("hazard_level") instanceof String s) run.setHazardLevel(s);
        if (aiResult.get("unavailability_reason") instanceof String s) {
            run.setUnavailabilityReason(s);
            if ("unavailable".equals(run.getAvailability())) {
                run.setJobStatus(JobStatus.UNAVAILABLE);
            }
        }
        ForecastRun saved = repo.save(run);
        log.info("Job {} COMPLETED: hazard={}, prob={}", runId, run.getHazardLevel(), run.getProbability());

        // AFTER persist → notify
        try {
            events.publishEvent("HAZARD_FORECAST_READY", Map.of(
                    "run_id", saved.getRunId().toString(),
                    "unit_id", saved.getUnitId(),
                    "hazard_level", String.valueOf(saved.getHazardLevel())));
        } catch (Exception e) {
            log.warn("Redis HAZARD_FORECAST_READY failed (non-fatal): {}", e.getMessage());
        }

        return saved;
    }
}

