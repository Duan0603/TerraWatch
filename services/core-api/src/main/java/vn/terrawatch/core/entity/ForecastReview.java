package vn.terrawatch.core.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Maps core_schema.forecast_reviews — officer review decision on a forecast run.
 */
@Entity
@Table(name = "forecast_reviews", schema = "core_schema")
public class ForecastReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "review_id")
    private Integer reviewId;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(name = "reviewer_id")
    private UUID reviewerId;

    @Column(name = "decision", nullable = false, columnDefinition = "core_schema.forecast_review_status")
    private String decision;

    @Column(name = "reason_notes")
    private String reasonNotes;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt = OffsetDateTime.now();

    public ForecastReview() {}

    public ForecastReview(UUID runId, UUID reviewerId, String decision, String reasonNotes) {
        this.runId = runId;
        this.reviewerId = reviewerId;
        this.decision = decision;
        this.reasonNotes = reasonNotes;
    }

    public Integer getReviewId() { return reviewId; }
    public UUID getRunId() { return runId; }
    public UUID getReviewerId() { return reviewerId; }
    public String getDecision() { return decision; }
    public String getReasonNotes() { return reasonNotes; }
    public OffsetDateTime getReviewedAt() { return reviewedAt; }
}

