package vn.terrawatch.core.dto;

/** reportedAt is the server receive time; observedAt/observedUntil are when the event was seen. status: submitted | processed | archived. */
public record FieldReportResponse(Integer reportId, String clientReportId, String status, String reportedAt,
                                  String observedAt, String observedUntil, String description, String imageUrl,
                                  Double latitude, Double longitude) {}
