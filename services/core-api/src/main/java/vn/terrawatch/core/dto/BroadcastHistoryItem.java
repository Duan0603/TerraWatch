package vn.terrawatch.core.dto;

import java.time.Instant;

/** One emergency broadcast for the admin history; {@code status} is active or revoked. */
public record BroadcastHistoryItem(String broadcastId, Instant sentAt, Integer areaId, String areaName, String severity,
                                   String message, String senderName, String runId, int recipients, int sent, int failed,
                                   String status, Instant validUntil, Instant revokedAt) {}
