package vn.terrawatch.core.dto;

public record CommunityReportRequest(
    String userId,
    Double longitude,
    Double latitude,
    String imageUrl,
    String description
) {}
