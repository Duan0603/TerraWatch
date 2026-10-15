package vn.terrawatch.core.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.LoginRequest;
import vn.terrawatch.core.dto.RegisterRequest;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.JwtTokenProvider;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final JwtTokenProvider tokens = new JwtTokenProvider("test-only-secret-at-least-thirty-two-bytes-long", 60_000);
    private AuthService auth;

    @BeforeEach
    void setUp() {
        auth = new AuthService(users, passwords, tokens);
    }

    @Test
    void registersOnlyCitizenWithBcryptAndPhone() {
        when(users.saveAndFlush(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            user.setUserId(UUID.randomUUID());
            assertThat(user.getRole()).isEqualTo("citizen");
            assertThat(passwords.matches("secret123", user.getPasswordHash())).isTrue();
            assertThat(user.getPhoneNumber()).isEqualTo("0901234567");
            return user;
        });
        var result = auth.register(new RegisterRequest("Test", "test@example.com", "secret123", "0901234567"));
        assertThat(result.role()).isEqualTo("citizen");
        assertThat(tokens.validateAndParse(result.token()).getSubject()).isEqualTo(result.user().userId());
    }

    @Test
    void rejectsExistingAndConcurrentlyRegisteredEmail() {
        var request = new RegisterRequest("Test", "test@example.com", "secret123", null);
        when(users.existsByEmail(request.email())).thenReturn(true);
        assertStatus(() -> auth.register(request), 409);
        verify(users, never()).saveAndFlush(any());
        when(users.existsByEmail(request.email())).thenReturn(false, true);
        when(users.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));
        assertStatus(() -> auth.register(request), 409);
    }

    @Test
    void logsInEveryRoleWithExisting2bHashAndRejectsBadCredentialsIdentically() {
        for (String role : new String[]{"citizen", "officer", "admin"}) {
            User user = new User("Test", role + "@example.com",
                passwords.encode("secret123").replace("$2a$", "$2b$"), role, null);
            user.setUserId(UUID.randomUUID());
            when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
            when(users.findById(user.getUserId())).thenReturn(Optional.of(user));
            assertThat(auth.login(new LoginRequest(user.getEmail(), "secret123")).role()).isEqualTo(role);
            assertThat(auth.getCurrentUser(user.getUserId()).role()).isEqualTo(role);
        }
    }

    @Test
    void rejectsUnknownUserWrongPasswordAndOversizedUtf8Password() {
        when(users.findByEmail("known@example.com")).thenReturn(Optional.of(
            new User("Test", "known@example.com", passwords.encode("secret123"), "citizen", null)));
        assertStatus(() -> auth.login(new LoginRequest("known@example.com", "wrong")), 401);
        assertStatus(() -> auth.login(new LoginRequest("unknown@example.com", "wrong")), 401);
        assertStatus(() -> auth.getCurrentUser(UUID.randomUUID()), 401);
        assertStatus(() -> auth.register(new RegisterRequest("Test", "test@example.com", "界".repeat(25), null)), 400);
    }

    private void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class, error ->
            assertThat(error.getStatusCode().value()).isEqualTo(status));
    }
}
