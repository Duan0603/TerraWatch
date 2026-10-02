package vn.terrawatch.core.dto;

public record BroadcastAlertRequest(
    String eventId,
    String riskLevel,
    String message,
    String targetArea
) {}
