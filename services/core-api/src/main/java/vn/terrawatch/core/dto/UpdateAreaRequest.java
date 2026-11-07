package vn.terrawatch.core.dto;

public record UpdateAreaRequest(
    String name,
    String description,
    Boolean isActive,
    Object geojson
) {}
