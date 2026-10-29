package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** The FCM registration token of the caller's phone. */
public record DeviceTokenRequest(
    @NotBlank @Size(max = 4096) String fcmToken,
    @Pattern(regexp = "(?i)android|ios|web", message = "Unknown device type") String deviceType
) {}
