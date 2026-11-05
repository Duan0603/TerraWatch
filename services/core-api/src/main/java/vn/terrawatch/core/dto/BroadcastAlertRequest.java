package vn.terrawatch.core.dto;

/** areaId (a monitoring area) wins over targetArea (matched against monitoring area names). runId optionally cites an approved, unexpired forecast run. */
public record BroadcastAlertRequest(
    String eventId,
    String riskLevel,
    String message,
    String targetArea,
    Integer areaId,
    String runId
) {}
