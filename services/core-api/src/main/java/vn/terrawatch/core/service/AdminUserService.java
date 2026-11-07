package vn.terrawatch.core.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.AdminUserItem;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.Role;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private final UserRepository users;

    public AdminUserService(UserRepository users) {
        this.users = users;
    }

    public List<AdminUserItem> listUsers(String search, String role, Boolean isActive, String approvalStatus) {
        String cleanSearch = search != null ? search.trim().toLowerCase(Locale.ROOT) : null;
        String cleanRole = role != null ? role.trim().toLowerCase(Locale.ROOT) : null;
        String cleanApproval = approvalStatus != null ? approvalStatus.trim().toLowerCase(Locale.ROOT) : null;

        return users.findAllByOrderByCreatedAtDesc().stream()
            .filter(u -> {
                if (cleanSearch != null && !cleanSearch.isEmpty()) {
                    String name = u.getFullName() != null ? u.getFullName().toLowerCase(Locale.ROOT) : "";
                    String email = u.getEmail() != null ? u.getEmail().toLowerCase(Locale.ROOT) : "";
                    String phone = u.getPhoneNumber() != null ? u.getPhoneNumber() : "";
                    if (!name.contains(cleanSearch) && !email.contains(cleanSearch) && !phone.contains(cleanSearch)) {
                        return false;
                    }
                }
                if (cleanRole != null && !cleanRole.isEmpty()) {
                    if (u.getRole() == null || !u.getRole().equalsIgnoreCase(cleanRole)) {
                        return false;
                    }
                }
                if (isActive != null) {
                    if (u.isActive() != isActive) {
                        return false;
                    }
                }
                if (cleanApproval != null && !cleanApproval.isEmpty()) {
                    if (u.getApprovalStatus() == null || !u.getApprovalStatus().equalsIgnoreCase(cleanApproval)) {
                        return false;
                    }
                }
                return true;
            })
            .map(this::toItem)
            .collect(Collectors.toList());
    }

    public AdminUserItem updateUserStatus(UUID userId, boolean isActive, UUID adminId) {
        if (userId.equals(adminId) && !isActive) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quản trị viên không thể tự khóa tài khoản của chính mình");
        }
        User user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));

        user.setActive(isActive);
        user.setUpdatedAt(OffsetDateTime.now());
        return toItem(users.save(user));
    }

    public AdminUserItem updateUserRole(UUID userId, String newRole, UUID adminId) {
        // Story 4.7: an admin cannot change their own role, so the system can never lose its last admin.
        if (userId.equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quản trị viên không thể tự đổi vai trò của chính mình");
        }
        if (newRole == null || newRole.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không được để trống");
        }
        String normalizedRole = newRole.trim().toLowerCase(Locale.ROOT);
        try {
            Role.valueOf(normalizedRole.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vai trò không hợp lệ: " + newRole);
        }

        User user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));

        user.setRole(normalizedRole);
        // An explicit role change by an admin settles any pending/rejected request.
        user.setApprovalStatus("approved");
        user.setUpdatedAt(OffsetDateTime.now());
        return toItem(users.save(user));
    }

    public AdminUserItem approveOfficer(UUID userId) {
        User user = pendingRequest(userId);

        user.setRole(Role.OFFICER.dbValue());
        user.setApprovalStatus("approved");
        user.setUpdatedAt(OffsetDateTime.now());
        return toItem(users.save(user));
    }

    public AdminUserItem rejectOfficer(UUID userId) {
        User user = pendingRequest(userId);

        user.setApprovalStatus("rejected");
        user.setUpdatedAt(OffsetDateTime.now());
        return toItem(users.save(user));
    }

    /** Approve/reject only answer a request that is still waiting; they must not re-role any account. */
    private User pendingRequest(UUID userId) {
        User user = users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng"));
        if (!"pending".equalsIgnoreCase(user.getApprovalStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tài khoản này không có yêu cầu đang chờ duyệt");
        }
        return user;
    }

    private AdminUserItem toItem(User u) {
        return new AdminUserItem(
            u.getUserId(),
            u.getFullName(),
            u.getEmail(),
            u.getRole(),
            u.getPhoneNumber(),
            u.isActive(),
            u.getApprovalStatus(),
            u.getDepartmentUnit(),
            u.getCreatedAt() != null ? u.getCreatedAt().toString() : null,
            u.getUpdatedAt() != null ? u.getUpdatedAt().toString() : null
        );
    }
}
