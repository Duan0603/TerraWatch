package vn.terrawatch.core.service;

import org.springframework.stereotype.Service;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CommunityReportService {

    private final SpatialRepository spatialRepository;

    public CommunityReportService(SpatialRepository spatialRepository) {
        this.spatialRepository = spatialRepository;
    }

    public List<Map<String, Object>> listReports() {
        return spatialRepository.listCommunityReports();
    }

    public Map<String, Object> submitReport(CommunityReportRequest req) {
        UUID userId = req.userId() != null 
            ? UUID.fromString(req.userId()) 
            : UUID.fromString("33333333-3333-3333-3333-333333333333");

        return spatialRepository.submitCommunityReport(
            userId,
            req.longitude(),
            req.latitude(),
            req.imageUrl(),
            req.description()
        );
    }
}
