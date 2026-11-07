package vn.terrawatch.core.dto;

import java.time.Instant;

public record AlertBroadcastResponse(
    String broadcastId,
    String title,
    String message,
    String severity,
    String areaName,
    Instant issuedAt,
    Instant validUntil,
    String status,
    boolean expired
) {}

