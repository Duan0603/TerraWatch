package vn.terrawatch.core.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** One approved forecast zone for the phone's offline cache; all instants are UTC.
 *  unitName/centroid let clients label the zone and look up its live rain without re-deriving a centre from the ring. */
public record ForecastZoneResponse(UUID runId, String unitId, String unitVersion, String hazardLevel,
                                   Double probability, Instant issuedAt, Instant validFrom, Instant validUntil,
                                   String modelVersion, JsonNode geometry,
                                   String unitName, Double centroidLat, Double centroidLng) {}
