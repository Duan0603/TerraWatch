package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.AdminUserItem;
import vn.terrawatch.core.dto.UpdateUserRoleRequest;
import vn.terrawatch.core.dto.UpdateUserStatusRequest;
import vn.terrawatch.core.service.AdminAuditService;
import vn.terrawatch.core.service.AdminUserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Users", description = "Quản trị người dùng, duyệt tài khoản cán bộ, khóa/mở tài khoản, phân quyền")
public class AdminUserController {

    private final AdminUserService adminUserService;

    private final AdminAuditService audit;

    public AdminUserController(AdminUserService adminUserService, AdminAuditService audit) {
        this.adminUserService = adminUserService;
        this.audit = audit;
    }

    private AdminUserItem logged(Authentication auth, String action, AdminUserItem item, String detail) {
        audit.record((UUID) auth.getPrincipal(), action, "user", item.userId().toString(), item.email(), detail);
        return item;
    }

    @GetMapping
    @Operation(summary = "Danh sách người dùng hệ thống kèm bộ lọc tìm kiếm và trạng thái phê duyệt")
    public ResponseEntity<List<AdminUserItem>> listUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean isActive,
            @RequestParam(required = false) String approvalStatus) {
        return ResponseEntity.ok(adminUserService.listUsers(search, role, isActive, approvalStatus));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Khóa hoặc mở khóa tài khoản người dùng")
    public ResponseEntity<AdminUserItem> updateUserStatus(
            @PathVariable UUID id,
            @RequestBody UpdateUserStatusRequest request,
            Authentication authentication) {
        UUID adminId = (UUID) authentication.getPrincipal();
        boolean active = request.isActive() != null ? request.isActive() : true;
        return ResponseEntity.ok(logged(authentication, active ? "USER_UNLOCK" : "USER_LOCK", adminUserService.updateUserStatus(id, active, adminId), null));
    }

    @PatchMapping("/{id}/role")
    @Operation(summary = "Phân quyền vai trò người dùng (ADMIN, OFFICER, CITIZEN)")
    public ResponseEntity<AdminUserItem> updateUserRole(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserRoleRequest request,
            Authentication authentication) {
        UUID adminId = (UUID) authentication.getPrincipal();
        AdminUserItem item = adminUserService.updateUserRole(id, request.role(), adminId);
        return ResponseEntity.ok(logged(authentication, "USER_ROLE", item, "role=" + item.role()));
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Phê duyệt tài khoản cán bộ")
    public ResponseEntity<AdminUserItem> approveOfficer(@PathVariable UUID id, Authentication authentication) {
        return ResponseEntity.ok(logged(authentication, "OFFICER_APPROVE", adminUserService.approveOfficer(id), null));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Từ chối phê duyệt tài khoản cán bộ")
    public ResponseEntity<AdminUserItem> rejectOfficer(@PathVariable UUID id, Authentication authentication) {
        return ResponseEntity.ok(logged(authentication, "OFFICER_REJECT", adminUserService.rejectOfficer(id), null));
    }
}
