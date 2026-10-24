package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.*;
import vn.terrawatch.core.service.AuthService;
import vn.terrawatch.core.service.GoogleAuthService;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Citizen registration and multi-role JWT login")
public class AuthController {
    private final AuthService auth;
    private final GoogleAuthService googleAuth;

    public AuthController(AuthService auth, GoogleAuthService googleAuth) {
        this.auth = auth;
        this.googleAuth = googleAuth;
    }

    @PostMapping("/google")
    @Operation(summary = "Sign in with Google: exchange a Firebase ID token for a citizen JWT")
    public AuthResponse google(@Valid @RequestBody GoogleLoginRequest request) {
        return googleAuth.login(request.idToken());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Register a citizen account")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Log in and receive a role-specific JWT")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @GetMapping("/me")
    @Operation(summary = "Get the authenticated user's profile")
    public UserProfileResponse me(Authentication authentication) {
        // JwtAuthenticationFilter always sets a UUID principal directly — no string round-trip needed.
        return auth.getCurrentUser((UUID) authentication.getPrincipal());
    }
}
