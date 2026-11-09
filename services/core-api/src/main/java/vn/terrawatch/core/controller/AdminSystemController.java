package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.terrawatch.core.service.SystemHealthService;

import java.util.Map;

/** Story 4.26: admin-only (the /api/v1/admin/** matcher) system health and data freshness. */
@RestController
@RequestMapping("/api/v1/admin/system-health")
@Tag(name = "Admin system health")
public class AdminSystemController {

    private final SystemHealthService health;

    public AdminSystemController(SystemHealthService health) {
        this.health = health;
    }

    @GetMapping
    @Operation(summary = "Trạng thái DB/Redis/AI/GIS và độ tươi của dữ liệu (chỉ admin)")
    public Map<String, Object> get() {
        return health.report();
    }
}
