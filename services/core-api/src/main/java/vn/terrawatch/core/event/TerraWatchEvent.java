package vn.terrawatch.core.event;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Standard Event Message Contract for TerraWatch Event-Driven Architecture.
 */
public record TerraWatchEvent(
    String eventId,
    String eventType,
    Instant timestamp,
    String sourceService,
    Map<String, Object> payload
) implements Serializable {

    public static TerraWatchEvent create(String eventType, String sourceService, Map<String, Object> payload) {
        return new TerraWatchEvent(
            UUID.randomUUID().toString(),
            eventType,
            Instant.now(),
            sourceService,
            payload
        );
    }
}
