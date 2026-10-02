package vn.terrawatch.core.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vn.terrawatch.core.dto.CreateAreaRequest;
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
        } catch (Exception e) {
            throw new RuntimeException("Invalid GeoJSON geometry payload", e);
        }
    }
}
