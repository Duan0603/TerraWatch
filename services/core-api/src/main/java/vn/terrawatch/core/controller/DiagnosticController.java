package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.client.GisServiceClient;
import vn.terrawatch.core.event.EventPublisher;

import java.util.Map;

/**
 * Diagnostic & Demonstration Controller for Capstone Defense.
 * Demonstrates:
 * 1. Circuit Breaker (Resilience4j) with AI and GIS Microservices.
 * 2. Event Bus (Redis Pub/Sub) event broadcasting.
 */
@RestController
@RequestMapping("/api/v1/diagnostic")
@Tag(name = "Microservices Diagnostics", description = "Kiểm tra Circuit Breaker (Resilience4j) & Message Broker (Redis)")
public class DiagnosticController {

    private final AiServiceClient aiServiceClient;
    private final GisServiceClient gisServiceClient;
    private final EventPublisher eventPublisher;

    public DiagnosticController(
            AiServiceClient aiServiceClient, 
            GisServiceClient gisServiceClient,
            EventPublisher eventPublisher) {
        this.aiServiceClient = aiServiceClient;
        this.gisServiceClient = gisServiceClient;
        this.eventPublisher = eventPublisher;
    }

    @GetMapping("/circuit-breaker/ai")
    @Operation(summary = "Demo Circuit Breaker gọi sang AI Service (tự động kích hoạt Fallback khi AI Service sập)")
    public ResponseEntity<Map<String, Object>> testAiCircuitBreaker() {
        return ResponseEntity.ok(aiServiceClient.predictLandslide(
            "TEST_SCENE_MUCANGCHAI_2026", 104.05, 21.80, 104.22, 21.92
        ));
    }

    @GetMapping("/circuit-breaker/gis")
    @Operation(summary = "Demo Circuit Breaker gọi sang GIS Service")
    public ResponseEntity<Map<String, Object>> testGisCircuitBreaker() {
        return ResponseEntity.ok(gisServiceClient.querySatelliteScenes(
            104.05, 21.80, 104.22, 21.92
        ));
    }

    @PostMapping("/event-bus/publish")
    @Operation(summary = "Demo Event Bus bắn sự kiện sang Redis Pub/Sub (Event-Driven Architecture)")
    public ResponseEntity<Map<String, Object>> testPublishEvent(
            @RequestParam(defaultValue = "TEST_EVENT") String eventType,
            @RequestParam(defaultValue = "Thông điệp kiểm thử Event Bus") String message) {
        eventPublisher.publishEvent(eventType, Map.of(
            "message", message,
            "status", "DISPATCHED_TO_REDIS"
        ));
        return ResponseEntity.ok(Map.of(
            "success", true,
            "channel", EventPublisher.CHANNEL_EVENTS,
            "eventType", eventType,
            "message", "Đã phát tán sự kiện thành công lên Redis Event Bus."
        ));
    }
}
