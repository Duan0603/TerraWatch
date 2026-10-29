package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.DeviceTokenRequest;
import vn.terrawatch.core.repository.DeviceTokenRepository;

import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts/devices")
@Tag(name = "Alert Devices", description = "Phones registered for push alerts")
public class DeviceController {
    private final DeviceTokenRepository devices;

    public DeviceController(DeviceTokenRepository devices) {
        this.devices = devices;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Register the caller's FCM token (a token held by another account moves to the caller)")
    public void register(Authentication authentication, @Valid @RequestBody DeviceTokenRequest request) {
        String type = request.deviceType() == null ? "android" : request.deviceType().toLowerCase(Locale.ROOT);
        devices.register(userId(authentication), request.fcmToken(), type);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Unregister the caller's FCM token (logout)")
    public void unregister(Authentication authentication, @Valid @RequestBody DeviceTokenRequest request) {
        devices.remove(userId(authentication), request.fcmToken());
    }

    private static UUID userId(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
