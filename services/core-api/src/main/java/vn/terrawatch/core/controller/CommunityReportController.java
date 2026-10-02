package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.service.CommunityReportService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/community-reports")
@Tag(name = "Community Reports", description = "Báo Cáo Hiện Trường Từ Người Dân (Crowdsourcing)")
public class CommunityReportController {

    private final CommunityReportService reportService;

    public CommunityReportController(CommunityReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    @Operation(summary = "UC09: Danh sách báo cáo hiện trường từ cộng đồng")
    public ResponseEntity<List<Map<String, Object>>> listReports() {
        return ResponseEntity.ok(reportService.listReports());
    }

    @PostMapping
    @Operation(summary = "UC09: Gửi ảnh chụp và tọa độ GPS sạt lở từ thiết bị di động")
    public ResponseEntity<Map<String, Object>> submitReport(@RequestBody CommunityReportRequest request) {
        return ResponseEntity.ok(reportService.submitReport(request));
    }
}
