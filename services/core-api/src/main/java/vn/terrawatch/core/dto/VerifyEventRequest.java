package vn.terrawatch.core.dto;

import jakarta.validation.constraints.Size;

public record VerifyEventRequest(
    String status,
    String riskLevel,
    @Size(max = 2000) String officerNote,
    String officerId
) {}
