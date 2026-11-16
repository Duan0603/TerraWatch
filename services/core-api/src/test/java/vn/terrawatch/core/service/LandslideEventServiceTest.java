package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.VerifyEventRequest;
import vn.terrawatch.core.entity.LandslideEvent;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.LandslideEventJpaRepository;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Unit tests with mocked repositories and event bus (AuthControllerTest only checks the HTTP status codes). */
class LandslideEventServiceTest {
    private final SpatialRepository spatial = mock(SpatialRepository.class);
    private final LandslideEventJpaRepository jpa = mock(LandslideEventJpaRepository.class);
    private final EventPublisher events = mock(EventPublisher.class);
    private final LandslideEventService service = new LandslideEventService(spatial, jpa, events);
    private final UUID officer = UUID.randomUUID();
    private final UUID event = UUID.randomUUID();

    private static VerifyEventRequest body(String status, String risk, String note) {
        return new VerifyEventRequest(status, risk, note, null);
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    @Test
    void badIdStatusOrRiskLevelIs400AndNothingIsWrittenOrPublished() {
        assertStatus(() -> service.verifyEvent("not-a-uuid", body("verified", null, null), officer), 400);
        assertStatus(() -> service.verifyEvent(event.toString(), body(null, null, null), officer), 400);
        assertStatus(() -> service.verifyEvent(event.toString(), body("VERIFIED", null, null), officer), 400);
        assertStatus(() -> service.verifyEvent(event.toString(), body("approved", null, null), officer), 400);
        assertStatus(() -> service.verifyEvent(event.toString(), body("verified", "critical", null), officer), 400);
        verifyNoInteractions(spatial, events);
    }

    @Test
    void everyAllowedStatusAndRiskLevelIsAccepted() {
        when(spatial.verifyEvent(any(), any(), anyString(), any(), any())).thenReturn(Map.of("ok", true));
        for (String s : List.of("pending", "verified", "rejected", "false_alarm")) {
            assertThat(service.verifyEvent(event.toString(), body(s, null, null), officer)).containsEntry("ok", true);
        }
        for (String r : List.of("low", "medium", "high", "extreme")) {
            service.verifyEvent(event.toString(), body("verified", r, null), officer);
        }
    }

    @Test
    void unknownIncidentIs404AndNoEventIsPublished() {
        when(spatial.verifyEvent(event, officer, "verified", null, null)).thenThrow(new EmptyResultDataAccessException(1));
        assertStatus(() -> service.verifyEvent(event.toString(), body("verified", null, null), officer), 404);
        verifyNoInteractions(events);
    }

    @Test
    void verifiedEventIsStoredThenPublishedWithOfficerAndRisk() {
        Map<String, Object> row = Map.of("status", "verified");
        when(spatial.verifyEvent(event, officer, "verified", "high", "checked on site")).thenReturn(row);

        assertThat(service.verifyEvent(event.toString(), body("verified", "high", "checked on site"), officer)).isSameAs(row);

        verify(events).publishEvent("LANDSLIDE_VERIFIED", Map.of(
            "eventId", event.toString(), "status", "verified", "riskLevel", "high", "officerId", officer.toString()));
    }

    @Test
    void publishedRiskLevelDefaultsToMediumWhenNotGiven() {
        when(spatial.verifyEvent(event, officer, "rejected", null, null)).thenReturn(Map.of());
        service.verifyEvent(event.toString(), body("rejected", null, null), officer);
        verify(events).publishEvent("LANDSLIDE_VERIFIED", Map.of(
            "eventId", event.toString(), "status", "rejected", "riskLevel", "medium", "officerId", officer.toString()));
    }

    @Test
    void readsAreForwardedToTheRepositories() {
        var queue = List.<Map<String, Object>>of(Map.of("event_id", "1"));
        when(spatial.getVerificationQueue()).thenReturn(queue);
        when(spatial.getActiveVerifiedEventsGeoJson()).thenReturn("{\"type\":\"FeatureCollection\"}");
        when(spatial.queryGeofence(105.5, 21.0, 300.0)).thenReturn(queue);
        when(spatial.exportOfflineSyncGeoJson()).thenReturn("{}");
        when(jpa.countByStatus("pending")).thenReturn(4L);
        when(jpa.findById(event)).thenReturn(Optional.empty());

        assertThat(service.getVerificationQueue()).isSameAs(queue);
        assertThat(service.getActiveVerifiedEvents()).contains("FeatureCollection");
        assertThat(service.queryGeofence(105.5, 21.0, 300.0)).isSameAs(queue);
        assertThat(service.exportOfflineSync()).isEqualTo("{}");
        assertThat(service.countPendingEvents()).isEqualTo(4L);
        assertThat(service.getEventById(event)).isEmpty();
    }
}
