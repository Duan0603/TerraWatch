package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.terrawatch.core.service.AdminAuditService;

import java.util.List;
import java.util.Map;

/** Story 4.27: admin-only (the /api/v1/admin/** matcher). */
@RestController
@RequestMapping("/api/v1/admin/audit")
@Tag(name = "Admin audit log")
public class AdminAuditController {

    private final AdminAuditService audit;

    public AdminAuditController(AdminAuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    @Operation(summary = "Nhật ký thao tác quản trị, mới nhất trước (tối đa 500 dòng)")
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "200") int limit) {
        return audit.list(limit);
    }
}
