package vn.terrawatch.core.dto;

public record VerifyEventRequest(
    String status,
    String riskLevel,
    String officerNote,
    String officerId
) {}
