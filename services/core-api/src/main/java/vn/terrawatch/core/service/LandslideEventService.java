package vn.terrawatch.core.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.dto.VerifyEventRequest;
import vn.terrawatch.core.entity.LandslideEvent;
import vn.terrawatch.core.repository.LandslideEventJpaRepository;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class LandslideEventService {

    private final SpatialRepository spatialRepository;
    private final LandslideEventJpaRepository landslideJpaRepository;

    public LandslideEventService(SpatialRepository spatialRepository, LandslideEventJpaRepository landslideJpaRepository) {
        this.spatialRepository = spatialRepository;
        this.landslideJpaRepository = landslideJpaRepository;
    }

    public List<Map<String, Object>> getVerificationQueue() {
        return spatialRepository.getVerificationQueue();
    }

    @Transactional
    public Map<String, Object> verifyEvent(String eventIdStr, VerifyEventRequest request) {
        UUID eventId = UUID.fromString(eventIdStr);
        UUID officerId = request.officerId() != null 
            ? UUID.fromString(request.officerId()) 
            : UUID.fromString("22222222-2222-2222-2222-222222222222");

        return spatialRepository.verifyEvent(
            eventId,
            officerId,
            request.status(),
            request.riskLevel(),
            request.officerNote()
        );
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
