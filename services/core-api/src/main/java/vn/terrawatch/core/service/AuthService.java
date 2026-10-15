package vn.terrawatch.core.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.*;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.JwtTokenProvider;
import vn.terrawatch.core.security.Role;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository users;
    private final BCryptPasswordEncoder passwords;
    private final JwtTokenProvider tokens;
    private final String dummyHash;

    public AuthService(UserRepository users, BCryptPasswordEncoder passwords, JwtTokenProvider tokens) {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.dummyHash = passwords.encode("unused-login-timing-check");
    }

    public AuthResponse register(RegisterRequest request) {
        validatePasswordLength(request.password());
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        User user = new User(request.fullName(), email, passwords.encode(request.password()),
            Role.CITIZEN.dbValue(), request.phoneNumber());
        try {
            user = users.saveAndFlush(user);
        } catch (DataIntegrityViolationException error) {
            if (users.existsByEmail(email)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
            }
            throw error;
        }
        return response(user);
    }

    public AuthResponse login(LoginRequest request) {
        validatePasswordLength(request.password());
        var user = users.findByEmail(normalizeEmail(request.email()));
        String storedHash = user.map(User::getPasswordHash).orElse(dummyHash);
        boolean matches;
        try {
            matches = passwords.matches(request.password(), storedHash);
        } catch (IllegalArgumentException malformedHash) {
            matches = false;
        }
        if (user.isEmpty() || !matches) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
        return response(user.get());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public UserProfileResponse getCurrentUser(UUID userId) {
        return profile(users.findById(userId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized")));
    }

    private void validatePasswordLength(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password exceeds 72 UTF-8 bytes");
        }
    }

    private AuthResponse response(User user) {
        requireKnownRole(user);
        return new AuthResponse(tokens.generateToken(user), user.getRole(), profile(user));
    }

    private UserProfileResponse profile(User user) {
        requireKnownRole(user);
        return new UserProfileResponse(user.getUserId().toString(), user.getFullName(), user.getEmail(),
            user.getRole(), user.getPhoneNumber());
    }

    /** Refuses to issue a token/profile for a row whose role isn't one of the three known values. */
    private static void requireKnownRole(User user) {
        if (Role.fromDbValue(user.getRole()).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                "User account has an invalid role and cannot be authenticated");
        }
    }
}
