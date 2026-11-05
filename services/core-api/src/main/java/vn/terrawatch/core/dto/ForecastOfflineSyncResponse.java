package vn.terrawatch.core.dto;

import java.time.Instant;
import java.util.List;

/** Full snapshot: the phone replaces its cache with {@code items}, so anything absent here is gone. */
public record ForecastOfflineSyncResponse(Instant serverTime, List<ForecastZoneResponse> items) {}
