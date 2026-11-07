package vn.terrawatch.core.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.dto.VerifyEventRequest;
import vn.terrawatch.core.entity.LandslideEvent;
import vn.terrawatch.core.repository.LandslideEventJpaRepository;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class LandslideEventService {

    private final SpatialRepository spatialRepository;
    private final LandslideEventJpaRepository landslideJpaRepository;
    private final vn.terrawatch.core.event.EventPublisher eventPublisher;

    public LandslideEventService(
            SpatialRepository spatialRepository, 
            LandslideEventJpaRepository landslideJpaRepository,
            vn.terrawatch.core.event.EventPublisher eventPublisher) {
        this.spatialRepository = spatialRepository;
        this.landslideJpaRepository = landslideJpaRepository;
        this.eventPublisher = eventPublisher;
    }

    public List<Map<String, Object>> getVerificationQueue() {
        return spatialRepository.getVerificationQueue();
    }

    @Transactional
    public Map<String, Object> verifyEvent(String eventIdStr, VerifyEventRequest request, UUID officerId) {
        UUID eventId;
        try {
            eventId = UUID.fromString(eventIdStr);
        } catch (IllegalArgumentException notAnId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid event id");
        }
        // Story 4.23: bad input is a 400/404, not a database error turned into a 500.
        if (request.status() == null || !java.util.Set.of("pending", "verified", "rejected", "false_alarm").contains(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be pending, verified, rejected or false_alarm");
        }
        if (request.riskLevel() != null && !java.util.Set.of("low", "medium", "high", "extreme").contains(request.riskLevel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "riskLevel must be low, medium, high or extreme");
        }

        Map<String, Object> result;
        try {
            result = spatialRepository.verifyEvent(eventId, officerId, request.status(), request.riskLevel(), request.officerNote());
        } catch (org.springframework.dao.EmptyResultDataAccessException missing) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found: " + eventId);
        }

        // Broadcast event to Redis Event Bus (Message Broker)
        eventPublisher.publishEvent("LANDSLIDE_VERIFIED", Map.of(
            "eventId", eventIdStr,
            "status", request.status(),
            "riskLevel", request.riskLevel() != null ? request.riskLevel() : "medium",
            "officerId", officerId.toString()
        ));

        return result;
    }

    public Optional<LandslideEvent> getEventById(UUID eventId) {
        return landslideJpaRepository.findById(eventId);
    }

    public long countPendingEvents() {
        return landslideJpaRepository.countByStatus("pending");
    }

    public String getActiveVerifiedEvents() {
        return spatialRepository.getActiveVerifiedEventsGeoJson();
    }

    public List<Map<String, Object>> queryGeofence(double lon, double lat, double radiusMeters) {
        return spatialRepository.queryGeofence(lon, lat, radiusMeters);
    }

    public String exportOfflineSync() {
        return spatialRepository.exportOfflineSyncGeoJson();
    }
}
