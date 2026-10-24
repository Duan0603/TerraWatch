package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.AvatarRequest;
import vn.terrawatch.core.dto.AvatarResponse;
import vn.terrawatch.core.dto.UserProfileResponse;
import vn.terrawatch.core.service.UserAvatarService;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth/me/avatar")
@Tag(name = "Authentication", description = "Profile picture of the signed-in user")
public class ProfileAvatarController {
    private final UserAvatarService avatars;

    public ProfileAvatarController(UserAvatarService avatars) {
        this.avatars = avatars;
    }

    @GetMapping
    @Operation(summary = "Get the signed-in user's avatar as base64 (404 when none)")
    public AvatarResponse get(Authentication authentication) {
        return new AvatarResponse(avatars.get(userId(authentication)));
    }

    @PutMapping
    @Operation(summary = "Set the avatar (JPEG or PNG, base64, up to 200 KB)")
    public UserProfileResponse set(Authentication authentication, @Valid @RequestBody AvatarRequest request) {
        return avatars.save(userId(authentication), request.imageBase64());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove the avatar")
    public void delete(Authentication authentication) {
        avatars.delete(userId(authentication));
    }

    // JwtAuthenticationFilter always sets a UUID principal.
    private static UUID userId(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
