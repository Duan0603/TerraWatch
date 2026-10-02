package vn.terrawatch.core.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.dto.VerifyEventRequest;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LandslideEventService {

    private final SpatialRepository spatialRepository;

    public LandslideEventService(SpatialRepository spatialRepository) {
        this.spatialRepository = spatialRepository;
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
