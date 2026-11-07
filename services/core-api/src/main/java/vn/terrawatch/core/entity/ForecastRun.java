package vn.terrawatch.core.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

/**
 * Maps core_schema.forecast_runs — persisted forecast job with lifecycle tracking.
 */
@Entity
@Table(name = "forecast_runs", schema = "core_schema")
public class ForecastRun {

    public enum JobStatus { PENDING, RUNNING, COMPLETED, FAILED, UNAVAILABLE }

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "run_id")
    private UUID runId;

    @Column(name = "snapshot_id")
    private UUID snapshotId;

    @Column(name = "unit_id", nullable = false)
    private String unitId;

    @Column(name = "unit_version")
    private String unitVersion = "v1";

    @Column(name = "issued_at", nullable = false)
    private OffsetDateTime issuedAt;

    @Column(name = "valid_from", nullable = false)
    private OffsetDateTime validFrom;

    @Column(name = "valid_until", nullable = false)
    private OffsetDateTime validUntil;

    @Column(name = "horizon_hours")
    private int horizonHours = 24;

    @Column(name = "availability")
    private String availability = "available";

    @Column(name = "unavailability_reason")
    private String unavailabilityReason;

    @Column(name = "probability")
    private Double probability;

    @Column(name = "experimental_score")
    private Double experimentalScore;

    @Column(name = "hazard_level", columnDefinition = "core_schema.risk_level")
    private String hazardLevel;

    @Column(name = "model_version", nullable = false)
    private String modelVersion;

    @Column(name = "threshold_version", nullable = false)
    private String thresholdVersion;

    @Column(name = "contributing_factors", columnDefinition = "jsonb")
    private String contributingFactors;

    @Column(name = "input_quality", columnDefinition = "jsonb")
    private String inputQuality;

    @Column(name = "review_status", columnDefinition = "core_schema.forecast_review_status")
    private String reviewStatus = "pending";

    @Column(name = "is_active")
    private boolean active = true;

    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // V8 orchestration columns — stored as VARCHAR for JPA compatibility
    @Column(name = "job_status")
    private String jobStatusRaw = "pending";

    @Column(name = "idempotency_key")
    private String idempotencyKey;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "retry_count")
    private int retryCount = 0;

    @Column(name = "max_retries")
    private int maxRetries = 3;

    @Column(name = "last_error")
    private String lastError;

    public ForecastRun() {}

    /** Generate idempotency key from natural key components. */
    public String generateIdempotencyKey() {
        this.idempotencyKey = String.join("|", unitId, unitVersion, modelVersion,
                issuedAt != null ? issuedAt.toString() : "",
                snapshotId != null ? snapshotId.toString() : "");
        return this.idempotencyKey;
    }

    @Transient
    public JobStatus getJobStatus() {
        try { return jobStatusRaw != null ? JobStatus.valueOf(jobStatusRaw.toUpperCase(Locale.ROOT)) : JobStatus.PENDING; }
        catch (IllegalArgumentException e) { return JobStatus.PENDING; }
    }
    public void setJobStatus(JobStatus status) { this.jobStatusRaw = status.name().toLowerCase(Locale.ROOT); }

    // --- Getters ---
    public UUID getRunId() { return runId; }
    public UUID getSnapshotId() { return snapshotId; }
    public String getUnitId() { return unitId; }
    public String getUnitVersion() { return unitVersion; }
    public OffsetDateTime getIssuedAt() { return issuedAt; }
    public OffsetDateTime getValidFrom() { return validFrom; }
    public OffsetDateTime getValidUntil() { return validUntil; }
    public int getHorizonHours() { return horizonHours; }
    public String getAvailability() { return availability; }
    public String getUnavailabilityReason() { return unavailabilityReason; }
    public Double getProbability() { return probability; }
    public Double getExperimentalScore() { return experimentalScore; }
    public String getHazardLevel() { return hazardLevel; }
    public String getModelVersion() { return modelVersion; }
    public String getThresholdVersion() { return thresholdVersion; }
    public String getContributingFactors() { return contributingFactors; }
    public String getInputQuality() { return inputQuality; }
    public String getReviewStatus() { return reviewStatus; }
    public boolean isActive() { return active; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public OffsetDateTime getStartedAt() { return startedAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public int getRetryCount() { return retryCount; }
    public int getMaxRetries() { return maxRetries; }
    public String getLastError() { return lastError; }

    // --- Setters ---
    public void setSnapshotId(UUID snapshotId) { this.snapshotId = snapshotId; }
    public void setUnitId(String unitId) { this.unitId = unitId; }
    public void setUnitVersion(String unitVersion) { this.unitVersion = unitVersion; }
    public void setIssuedAt(OffsetDateTime issuedAt) { this.issuedAt = issuedAt; }
    public void setValidFrom(OffsetDateTime validFrom) { this.validFrom = validFrom; }
    public void setValidUntil(OffsetDateTime validUntil) { this.validUntil = validUntil; }
    public void setHorizonHours(int horizonHours) { this.horizonHours = horizonHours; }
    public void setAvailability(String availability) { this.availability = availability; }
    public void setUnavailabilityReason(String reason) { this.unavailabilityReason = reason; }
    public void setProbability(Double probability) { this.probability = probability; }
    public void setExperimentalScore(Double experimentalScore) { this.experimentalScore = experimentalScore; }
    public void setHazardLevel(String hazardLevel) { this.hazardLevel = hazardLevel; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public void setThresholdVersion(String thresholdVersion) { this.thresholdVersion = thresholdVersion; }
    public void setContributingFactors(String contributingFactors) { this.contributingFactors = contributingFactors; }
    public void setInputQuality(String inputQuality) { this.inputQuality = inputQuality; }
    public void setReviewStatus(String reviewStatus) { this.reviewStatus = reviewStatus; }
    public void setActive(boolean active) { this.active = active; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public void setStartedAt(OffsetDateTime startedAt) { this.startedAt = startedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    public void setMaxRetries(int maxRetries) { this.maxRetries = maxRetries; }
    public void setLastError(String lastError) { this.lastError = lastError; }
}
