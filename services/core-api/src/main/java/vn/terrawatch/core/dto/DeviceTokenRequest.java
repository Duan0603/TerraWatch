package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeviceTokenRequest(
    @NotBlank @Size(max = 4096) String fcmToken,
    @Size(max = 20) String deviceType
) {}

