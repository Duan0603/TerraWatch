package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;

public record DeviceTokenRequest(
    @NotBlank String fcmToken,
    String deviceType
) {}

