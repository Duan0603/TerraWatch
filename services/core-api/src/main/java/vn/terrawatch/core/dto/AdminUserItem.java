package vn.terrawatch.core.dto;

import java.util.UUID;

public record AdminUserItem(
    UUID userId,
    String fullName,
    String email,
    String role,
    String phoneNumber,
    boolean isActive,
    String approvalStatus,
    String createdAt,
    String updatedAt
) {}
