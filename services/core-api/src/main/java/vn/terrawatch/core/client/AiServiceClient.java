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

    /**
     * Story 4.1: Request 24h rainfall-terrain forecast from AI Service.
     * Returns the raw AI response map, or null on circuit-breaker fallback.
     */
    @CircuitBreaker(name = "aiService", fallbackMethod = "fallbackForecast")
    @SuppressWarnings("unchecked")
    public Map<String, Object> requestForecast(Map<String, Object> forecastRequest) {
        String endpoint = aiServiceUrl + "/api/v1/forecasts";
        log.info("Requesting forecast from AI: {} for unit: {}", endpoint, forecastRequest.get("assessment_unit_id"));
        ResponseEntity<Map> response = restTemplate.postForEntity(endpoint, forecastRequest, Map.class);
        return response.getBody();
    }

    /** Fallback: returns null so caller knows AI was unavailable — never fabricate a forecast. */
    public Map<String, Object> fallbackForecast(Map<String, Object> forecastRequest, Throwable throwable) {
        log.warn("⚠️ AI forecast unavailable for unit {}: {}", forecastRequest.get("assessment_unit_id"), throwable.getMessage());
        return null;
    }

    /** Story 4.29: the segmentation model card, exactly as the AI service reports it. */
    @CircuitBreaker(name = "aiService", fallbackMethod = "fallbackCard")
    @SuppressWarnings("unchecked")
    public Map<String, Object> segmentationCard() {
        return restTemplate.getForObject(aiServiceUrl + "/api/v1/models/info", Map.class);
    }

    /** Story 4.29: the GRU model card, exactly as the AI service reports it. */
    @CircuitBreaker(name = "aiService", fallbackMethod = "fallbackCard")
    @SuppressWarnings("unchecked")
    public Map<String, Object> gruCard() {
        return restTemplate.getForObject(aiServiceUrl + "/api/v1/models/gru/info", Map.class);
    }

    /** Fallback: say the card is unavailable; never fill in numbers. */
    public Map<String, Object> fallbackCard(Throwable throwable) {
        log.warn("AI model card unavailable: {}", throwable.getMessage());
        return Map.of("ready", false);
    }
}
