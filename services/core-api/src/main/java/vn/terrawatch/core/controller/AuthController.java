package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.*;
import vn.terrawatch.core.service.EmailResetService;
import vn.terrawatch.core.service.AuthService;
import vn.terrawatch.core.service.GoogleAuthService;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Citizen registration and multi-role JWT login")
public class AuthController {
    private final AuthService auth;
    private final GoogleAuthService googleAuth;
    private final EmailResetService emailReset;

    public AuthController(AuthService auth, GoogleAuthService googleAuth, EmailResetService emailReset) {
        this.auth = auth;
        this.googleAuth = googleAuth;
        this.emailReset = emailReset;
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

    @PostMapping("/officer-requests")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Request an officer account: verified phone required, pending until an admin approves")
    public OfficerRequestResponse officerRequest(@Valid @RequestBody OfficerRequest request) {
        return auth.requestOfficer(request);
    }

    @GetMapping("/email-exists")
    @Operation(summary = "Is this email already registered? (public, used by the sign-up form before sending an OTP)")
    public Map<String, Boolean> emailExists(@RequestParam String email) {
        return Map.of("exists", auth.emailExists(email));
    }

    @PostMapping("/password-reset/email/request")
    @Operation(summary = "E-mail a 6-digit reset code (same answer whether or not the e-mail has an account)")
    public Map<String, Boolean> emailResetRequest(@Valid @RequestBody EmailResetRequest request) {
        emailReset.request(request.email());
        return Map.of("sent", true);
    }

    @PostMapping("/password-reset/email/verify")
    @Operation(summary = "Check the e-mailed code; a right code returns a one-time reset token")
    public Map<String, String> emailResetVerify(@Valid @RequestBody EmailResetVerify request) {
        return Map.of("resetToken", emailReset.verify(request.email(), request.code()));
    }

    @PostMapping("/password-reset/email/complete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Set the new password with the one-time reset token")
    public void emailResetComplete(@Valid @RequestBody EmailResetComplete request) {
        emailReset.complete(request.email(), request.resetToken(), request.newPassword());
    }

    @PostMapping("/password-reset/check")
    @Operation(summary = "Does this email belong to this phone? (asked before the OTP SMS is sent)")
    public Map<String, Boolean> passwordResetCheck(@Valid @RequestBody PasswordResetCheck request) {
        return Map.of("eligible", auth.canResetPassword(request.email(), request.phoneNumber()));
    }

    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Set a new password after proving the registered phone with a Firebase OTP token")
    public void passwordReset(@Valid @RequestBody PasswordResetRequest request) {
        auth.resetPassword(request);
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

    @PutMapping("/me")
    @Operation(summary = "Update the authenticated user's name and phone number")
    public UserProfileResponse updateMe(Authentication authentication, @Valid @RequestBody UpdateProfileRequest request) {
        return auth.updateProfile((UUID) authentication.getPrincipal(), request);
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Change the password of an email/password account")
    public void changePassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest request) {
        auth.changePassword((UUID) authentication.getPrincipal(), request);
    }
}
