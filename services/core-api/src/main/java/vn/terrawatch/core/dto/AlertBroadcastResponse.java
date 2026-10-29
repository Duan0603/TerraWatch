package vn.terrawatch.core.dto;

import java.time.Instant;

/** A broadcast delivered to the caller; {@code status} is active or revoked, {@code expired} is relative to now. */
public record AlertBroadcastResponse(String broadcastId, String title, String message, String severity, String areaName,
                                     Instant issuedAt, Instant validUntil, String status, boolean expired) {}
