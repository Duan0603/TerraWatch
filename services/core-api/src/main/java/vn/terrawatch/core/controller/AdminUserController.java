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
import vn.terrawatch.core.service.AdminUserService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Users", description = "Quản trị người dùng, duyệt tài khoản cán bộ, khóa/mở tài khoản, phân quyền")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
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
        return ResponseEntity.ok(adminUserService.updateUserStatus(id, active, adminId));
    }

    @PatchMapping("/{id}/role")
    @Operation(summary = "Phân quyền vai trò người dùng (ADMIN, OFFICER, CITIZEN)")
    public ResponseEntity<AdminUserItem> updateUserRole(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserRoleRequest request,
            Authentication authentication) {
        UUID adminId = (UUID) authentication.getPrincipal();
        return ResponseEntity.ok(adminUserService.updateUserRole(id, request.role(), adminId));
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Phê duyệt tài khoản cán bộ")
    public ResponseEntity<AdminUserItem> approveOfficer(@PathVariable UUID id) {
        return ResponseEntity.ok(adminUserService.approveOfficer(id));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Từ chối phê duyệt tài khoản cán bộ")
    public ResponseEntity<AdminUserItem> rejectOfficer(@PathVariable UUID id) {
        return ResponseEntity.ok(adminUserService.rejectOfficer(id));
    }
}
