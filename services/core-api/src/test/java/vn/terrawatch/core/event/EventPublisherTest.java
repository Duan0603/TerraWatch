package vn.terrawatch.core.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * The event bus when Redis misbehaves (IF-DASH-001, 002, 004, 005, 006). Every caller (forecast review, job creation, incident
 * verification, the diagnostic route) publishes after its own database write and relies on publishEvent never throwing, so
 * a Redis outage must not turn a saved decision into an error. No Spring context: plain objects and a mocked template.
 * Not asserted here: IF-DASH-003 (slow Redis). The publisher sets no timeout of its own; the wait is whatever the Redis
 * client is configured with, which a unit test cannot show.
 */
class EventPublisherTest {
    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    private final EventPublisher publisher = new EventPublisher(redis, json);

    @Test
    void anEventGoesOutAsOneJsonEnvelopeOnTheEventsChannel() throws Exception {
        // IF-DASH-001
        publisher.publishEvent("FORECAST_REVIEWED", Map.of("run_id", "r1", "decision", "approved"));

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(redis).convertAndSend(eq("terrawatch:events"), message.capture());
        JsonNode event = json.readTree(message.getValue());
        assertThat(event.get("eventType").asText()).isEqualTo("FORECAST_REVIEWED");
        assertThat(event.get("sourceService").asText()).isEqualTo("core-api");
        assertThat(event.get("eventId").asText()).isNotBlank();
        assertThat(event.get("payload").get("run_id").asText()).isEqualTo("r1");
    }

    @Test
    void aRedisOutageIsSwallowedSoTheCallerKeepsItsAnswer() {
        // IF-DASH-002 / IF-DASH-004: connection refused and a server error reply both stay inside the publisher
        doThrow(new RedisConnectionFailureException("Connection refused")).when(redis).convertAndSend(anyString(), anyString());
        assertThatCode(() -> publisher.publishEvent("LANDSLIDE_VERIFIED", Map.of("eventId", "e1"))).doesNotThrowAnyException();

        doThrow(new org.springframework.data.redis.RedisSystemException("ERR max clients reached", new RuntimeException("ERR")))
            .when(redis).convertAndSend(anyString(), anyString());
        assertThatCode(() -> publisher.publishEvent("LANDSLIDE_VERIFIED", Map.of("eventId", "e2"))).doesNotThrowAnyException();
    }

    @Test
    void aPayloadThatCannotBeSerialisedIsDroppedBeforeAnythingIsSentToRedis() {
        // IF-DASH-005: garbage on our side of the contract: nothing partial reaches the bus
        Map<String, Object> payload = new HashMap<>();
        payload.put("self", payload); // a map that contains itself cannot become JSON

        assertThatCode(() -> publisher.publishEvent("BAD", payload)).doesNotThrowAnyException();

        verify(redis, never()).convertAndSend(anyString(), anyString());
    }

    @Test
    void afterTheOutageTheSamePublisherSendsAgainWithoutARestart() {
        // IF-DASH-006
        doThrow(new RedisConnectionFailureException("down")).when(redis).convertAndSend(anyString(), anyString());
        publisher.publishEvent("A", Map.of("n", 1));
        org.mockito.Mockito.reset(redis);

        publisher.publishEvent("B", Map.of("n", 2));

        verify(redis, times(1)).convertAndSend(eq("terrawatch:events"), org.mockito.ArgumentMatchers.contains("\"eventType\":\"B\""));
    }
}
