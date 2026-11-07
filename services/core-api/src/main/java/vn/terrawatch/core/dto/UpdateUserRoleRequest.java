package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserRoleRequest(
    @NotBlank String role
) {}
