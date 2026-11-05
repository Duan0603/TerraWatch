package vn.terrawatch.core.dto;

import java.time.Instant;
import java.util.UUID;

public record ForecastJobResponse(UUID runId, String jobStatus, String idempotencyKey, Instant createdAt) {}

