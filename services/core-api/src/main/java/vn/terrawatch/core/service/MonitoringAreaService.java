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

    // Chấp nhận khi PostGIS coi là hình hợp lệ; ngược lại (hình nơ, GeoJSON hỏng, thiếu hình) trả 400 thay vì lưu hoặc báo 500.
    private String validGeoJson(Object geojson) {
        try {
            String geoJsonStr = objectMapper.writeValueAsString(geojson);
            if (Boolean.TRUE.equals(spatialRepository.isValidGeometry(geoJsonStr))) {
                return geoJsonStr;
            }
        } catch (Exception e) {
            // không đọc được GeoJSON: cùng một lỗi 400 bên dưới
        }
        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,
            "Monitoring area boundary is not a valid polygon (it may cross itself)");
    }

    public Map<String, Object> createArea(CreateAreaRequest request) {
        String geoJsonStr = validGeoJson(request.geojson());
        try {
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
        String geoJsonStr = request.geojson() != null ? validGeoJson(request.geojson()) : null;
        try {
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
