package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.CreateAreaRequest;
import vn.terrawatch.core.service.MonitoringAreaService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/monitoring-areas")
@Tag(name = "Monitoring Areas", description = "Quản lý Vùng Giám Sát Trọng Điểm (AOI)")
public class MonitoringAreaController {

    private final MonitoringAreaService areaService;

    public MonitoringAreaController(MonitoringAreaService areaService) {
        this.areaService = areaService;
    }

    @GetMapping
    @Operation(summary = "FR1.1 / UC01: Danh sách các khu vực trọng điểm theo dõi")
    public ResponseEntity<List<Map<String, Object>>> listAreas() {
        return ResponseEntity.ok(areaService.listAreas());
    }

    @PostMapping
    @Operation(summary = "FR1.1 / UC01: Thêm mới vùng giám sát bằng GeoJSON MultiPolygon")
    public ResponseEntity<Map<String, Object>> createArea(@RequestBody CreateAreaRequest request) {
        return ResponseEntity.ok(areaService.createArea(request));
    }
}
