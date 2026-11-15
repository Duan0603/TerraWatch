package vn.terrawatch.core.dto;

import jakarta.validation.constraints.Size;

public record CreateAreaRequest(
    @Size(max = 255) String name,
    @Size(max = 2000) String description,
    Object geojson
) {}
