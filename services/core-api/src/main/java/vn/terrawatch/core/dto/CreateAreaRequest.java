package vn.terrawatch.core.dto;

public record CreateAreaRequest(
    String name,
    String description,
    Object geojson
) {}
