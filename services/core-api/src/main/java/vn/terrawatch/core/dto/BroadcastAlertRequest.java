package vn.terrawatch.core.dto;

/** areaId (a monitoring area) wins over targetArea (matched against monitoring area names). */
public record BroadcastAlertRequest(
    String eventId,
    String riskLevel,
    String message,
    String targetArea,
    Integer areaId
) {}
