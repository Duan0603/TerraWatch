package vn.terrawatch.core.dto;

import jakarta.validation.constraints.Size;

public record UpdateAreaRequest(
    @Size(max = 255) String name,
    @Size(max = 2000) String description,
    Boolean isActive,
    Object geojson
) {}
