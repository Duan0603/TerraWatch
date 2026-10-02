package vn.terrawatch.core.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Client invoking AI Inference Service with Resilience4j Circuit Breaker protection.
 * Prevents cascading failure when AI models or GPU/ONNX runtimes are overloaded.
 */
@Service
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);

    private final RestTemplate restTemplate;
    private final String aiServiceUrl;

    public AiServiceClient(RestTemplate restTemplate, @Value("${services.ai.url}") String aiServiceUrl) {
        this.restTemplate = restTemplate;
        this.aiServiceUrl = aiServiceUrl;
    }

    @CircuitBreaker(name = "aiService", fallbackMethod = "fallbackPredict")
    public Map<String, Object> predictLandslide(String sceneId, double minLon, double minLat, double maxLon, double maxLat) {
        String endpoint = aiServiceUrl + "/api/v1/inference";
        Map<String, Object> payload = new HashMap<>();
        payload.put("satellite_scene_id", sceneId);
        payload.put("bbox", new double[]{minLon, minLat, maxLon, maxLat});
        payload.put("confidence_threshold", 0.75);

        log.info("Calling AI Service: {} for scene: {}", endpoint, sceneId);
        ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, payload, Map.class);
        return response.getBody();
    }

    /**
     * Fallback method triggered when Circuit Breaker is OPEN or call fails.
     */
    public Map<String, Object> fallbackPredict(String sceneId, double minLon, double minLat, double maxLon, double maxLat, Throwable throwable) {
        log.warn("⚠️ [Circuit Breaker OPEN / Fallback] AI Service unavailable for scene: {}. Error: {}", sceneId, throwable.getMessage());
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("success", false);
        fallback.put("status", "CIRCUIT_BREAKER_FALLBACK");
        fallback.put("scene_id", sceneId);
        fallback.put("message", "AI Inference Service is temporarily unavailable. Request queued for batch processing.");
        fallback.put("detected_polygons", Collections.emptyList());
        return fallback;
    }
}
