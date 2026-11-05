package vn.terrawatch.core.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One forecast proposal for officer review, with the evidence behind it (Story 4.2/4.3).
 * All instants are UTC. {@code expired} is computed at read time, never stored.
 */
public record ForecastReviewItem(
        UUID runId, String hazardLevel, Double probability, Double experimentalScore,
        Instant issuedAt, Instant validFrom, Instant validUntil, int horizonHours,
        String availability, String unavailabilityReason, String reviewStatus, boolean expired,
        String modelVersion, String thresholdVersion, JsonNode contributingFactors, JsonNode inputQuality,
        Unit unit, List<RainObs> observedRain, List<RainFc> forecastRain, List<PriorRun> priorRuns) {

    /** Assessment unit: a hazard assessment area, not an observed scar. */
    public record Unit(String unitId, String unitVersion, String name, String province, String district, String commune,
                       Double slopeAvg, Double slopeMax, Double elevationAvg, Double reliefM, Double effectiveResolutionM,
                       Double centroidLng, Double centroidLat, JsonNode geometry, Integer areaId) {}

    /** Observed rainfall interval; {@code mm} is null when the data is missing (never 0). */
    public record RainObs(Instant intervalStart, Instant intervalEnd, Double mm, String quality, String source) {}

    public record RainFc(String providerRunId, String provider, Instant issuedAt, Instant validFrom, Instant validUntil,
                         double mm24h, String quality) {}

    public record PriorRun(UUID runId, Instant issuedAt, String hazardLevel, Double probability, String reviewStatus) {}

    public ForecastReviewItem withEvidence(List<RainObs> obs, List<RainFc> fc, List<PriorRun> prior) {
        return new ForecastReviewItem(runId, hazardLevel, probability, experimentalScore, issuedAt, validFrom, validUntil,
                horizonHours, availability, unavailabilityReason, reviewStatus, expired, modelVersion, thresholdVersion,
                contributingFactors, inputQuality, unit, obs, fc, prior);
    }
}
