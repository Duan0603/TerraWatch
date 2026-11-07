package vn.terrawatch.core.dto;

import java.time.Instant;
import java.util.UUID;

public record ForecastReviewAuditItem(
    Integer reviewId,
    UUID runId,
    String unitId,
    String hazardLevel,
    UUID reviewerId,
    String reviewerName,
    String reviewerEmail,
    String reviewerRole,
    String decision,
    String reasonNotes,
    Instant reviewedAt
) {}
