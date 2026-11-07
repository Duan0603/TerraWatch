package vn.terrawatch.core.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vn.terrawatch.core.dto.CreateAreaRequest;
import vn.terrawatch.core.dto.UpdateAreaRequest;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import java.util.Map;

@Service
public class MonitoringAreaService {

    private final SpatialRepository spatialRepository;
    private final ObjectMapper objectMapper;

    public MonitoringAreaService(SpatialRepository spatialRepository, ObjectMapper objectMapper) {
        this.spatialRepository = spatialRepository;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> listAreas() {
        return spatialRepository.listMonitoringAreas();
    }

    public Map<String, Object> createArea(CreateAreaRequest request) {
        try {
            String geoJsonStr = objectMapper.writeValueAsString(request.geojson());
            return spatialRepository.createMonitoringArea(request.name(), request.description(), geoJsonStr);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // tên vùng là duy nhất từ migration V10
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                "A monitoring area with this name already exists");
        } catch (Exception e) {
            throw new RuntimeException("Invalid GeoJSON geometry payload", e);
        }
    }

    public Map<String, Object> updateArea(int id, UpdateAreaRequest request) {
        try {
            String geoJsonStr = request.geojson() != null ? objectMapper.writeValueAsString(request.geojson()) : null;
            return spatialRepository.updateMonitoringArea(id, request.name(), request.description(), request.isActive(), geoJsonStr);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,
                "Monitoring area not found with id: " + id);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                "A monitoring area with this name already exists");
        } catch (Exception e) {
            throw new RuntimeException("Error updating monitoring area", e);
        }
    }
}
