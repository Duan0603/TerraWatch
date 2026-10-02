package vn.terrawatch.core.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Message Broker / Event Bus Publisher using Redis Pub/Sub.
 * Enables Event-Driven Microservices communication (e.g. broadcasting verified landslides to AI/GIS/Notification services).
 */
@Service
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);
    public static final String CHANNEL_EVENTS = "terrawatch:events";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public EventPublisher(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public void publishEvent(String eventType, Map<String, Object> payload) {
        try {
            TerraWatchEvent event = TerraWatchEvent.create(eventType, "core-api", payload);
            String jsonMessage = objectMapper.writeValueAsString(event);
            redisTemplate.convertAndSend(CHANNEL_EVENTS, jsonMessage);
            log.info("📢 [EventBus Published] Channel: {} | Type: {} | ID: {}", CHANNEL_EVENTS, eventType, event.eventId());
        } catch (Exception e) {
            log.warn("⚠️ [EventBus Error] Could not publish event {} to Redis: {}", eventType, e.getMessage());
        }
    }
}
