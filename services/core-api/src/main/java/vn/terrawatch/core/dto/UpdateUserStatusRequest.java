package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;

public record UpdateUserStatusRequest(
    @JsonAlias({"is_active", "active"}) Boolean isActive
) {}
