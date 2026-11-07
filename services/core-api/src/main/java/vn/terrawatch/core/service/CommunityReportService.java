package vn.terrawatch.core.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.entity.CommunityReport;
import vn.terrawatch.core.repository.CommunityReportJpaRepository;
import vn.terrawatch.core.repository.SpatialRepository;

import java.util.List;
import java.util.Map;

@Service
public class CommunityReportService {

    private final SpatialRepository spatialRepository;
    private final CommunityReportJpaRepository reportJpaRepository;

    public CommunityReportService(SpatialRepository spatialRepository, CommunityReportJpaRepository reportJpaRepository) {
        this.spatialRepository = spatialRepository;
        this.reportJpaRepository = reportJpaRepository;
    }

    public List<Map<String, Object>> listReports() {
        return spatialRepository.listCommunityReports();
    }

    public List<CommunityReport> listRecentJpaReports() {
        return reportJpaRepository.findAllByOrderByReportTimeDesc();
    }

    public Map<String, Object> updateStatus(Integer reportId, String status) {
        int updated = spatialRepository.updateReportStatus(reportId, status);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found with id: " + reportId);
        }
        return Map.of("reportId", reportId, "status", status);
    }
}
