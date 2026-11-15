package vn.terrawatch.core.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Client invoking GIS Data Service with Resilience4j Circuit Breaker protection.
 */
@Service
public class GisServiceClient {

    private static final Logger log = LoggerFactory.getLogger(GisServiceClient.class);

    private final RestTemplate restTemplate;
    private final String gisServiceUrl;

    public GisServiceClient(RestTemplate restTemplate, @Value("${services.gis.url}") String gisServiceUrl) {
        this.restTemplate = restTemplate;
        this.gisServiceUrl = gisServiceUrl;
    }

    @CircuitBreaker(name = "gisService", fallbackMethod = "fallbackQuerySatellite")
    public Map<String, Object> querySatelliteScenes(double minLon, double minLat, double maxLon, double maxLat) {
        String endpoint = gisServiceUrl + "/api/v1/gis/query-satellite";
        Map<String, Object> payload = new HashMap<>();
        payload.put("bbox", new double[]{minLon, minLat, maxLon, maxLat});
        payload.put("max_cloud_coverage", 20.0);
        LocalDate today = LocalDate.now();
        payload.put("date_from", today.minusDays(30).toString());
        payload.put("date_to", today.toString());

        log.info("Calling GIS Service: {}", endpoint);
        ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, payload, Map.class);
        // an empty 200 reply reads as unavailable, never as a null body
        return response.getBody() != null ? response.getBody()
            : fallbackQuerySatellite(minLon, minLat, maxLon, maxLat, new IllegalStateException("empty response"));
    }

    public Map<String, Object> fallbackQuerySatellite(double minLon, double minLat, double maxLon, double maxLat, Throwable throwable) {
        log.warn("⚠️ [Circuit Breaker OPEN / Fallback] GIS Service unavailable. Error: {}", throwable.getMessage());
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("success", false);
        fallback.put("status", "CIRCUIT_BREAKER_FALLBACK");
        fallback.put("message", "GIS Data Service is currently unavailable.");
        fallback.put("scenes_found", Collections.emptyList());
        return fallback;
    }
}
