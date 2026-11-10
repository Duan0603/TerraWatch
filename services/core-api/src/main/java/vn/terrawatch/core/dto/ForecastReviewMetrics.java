package vn.terrawatch.core.dto;

/**
 * Story 4.34: review performance over the last {@code windowDays} days.
 * Minutes are issue-to-decision; null when nothing was decided in the window (never 0).
 * {@code expiredUnreviewed}: available proposals that ran out of validity still waiting for a decision.
 */
public record ForecastReviewMetrics(
    int windowDays,
    long approved,
    long rejected,
    Double avgMinutes,
    Double medianMinutes,
    long expiredUnreviewed
) {}
