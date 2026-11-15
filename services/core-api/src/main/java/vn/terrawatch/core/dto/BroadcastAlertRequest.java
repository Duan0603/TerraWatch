package vn.terrawatch.core.dto;

import jakarta.validation.constraints.Size;

/** areaId (a monitoring area) wins over targetArea (matched against monitoring area names). runId optionally cites an approved, unexpired forecast run. */
public record BroadcastAlertRequest(
    @Size(max = 100) String eventId,
    String riskLevel,
    @Size(max = 1000) String message,
    String targetArea,
    Integer areaId,
    String runId,
    String incidentPhase
) {}
