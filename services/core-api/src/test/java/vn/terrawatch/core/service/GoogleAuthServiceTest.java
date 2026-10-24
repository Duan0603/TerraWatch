package vn.terrawatch.core.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import vn.terrawatch.core.security.JwtTokenProvider;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GoogleAuthServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final FirebaseIdTokenVerifier verifier = mock(FirebaseIdTokenVerifier.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    private final JwtTokenProvider tokens = new JwtTokenProvider("test-only-secret-at-least-thirty-two-bytes-long", 60_000);
    private GoogleAuthService google;

    @BeforeEach
    void setUp() {
        google = new GoogleAuthService(users, passwords, verifier, new AuthService(users, passwords, tokens));
    }

    @Test
    void createsCitizenWithUnguessablePasswordForNewVerifiedEmail() {
        when(verifier.verify("tok")).thenReturn(new FirebaseIdTokenVerifier.GoogleIdentity("New.User@Example.com", "New User"));
        when(users.findByEmail("new.user@example.com")).thenReturn(Optional.empty());
        when(users.saveAndFlush(any(User.class))).thenAnswer(call -> {
            User user = call.getArgument(0);
            user.setUserId(UUID.randomUUID());
            assertThat(user.getRole()).isEqualTo("citizen");
            assertThat(user.getEmail()).isEqualTo("new.user@example.com");
            assertThat(user.getFullName()).isEqualTo("New User");
            assertThat(user.getPasswordHash()).startsWith("$2");
            return user;
        });
        var result = google.login("tok");
        assertThat(result.role()).isEqualTo("citizen");
        assertThat(tokens.validateAndParse(result.token()).get("email")).isEqualTo("new.user@example.com");
    }

    @Test
    void signsInExistingCitizenWithoutCreatingAnother() {
        User existing = new User("An", "an@example.com", "hash", "citizen", null);
        existing.setUserId(UUID.randomUUID());
        when(verifier.verify("tok")).thenReturn(new FirebaseIdTokenVerifier.GoogleIdentity("an@example.com", "An"));
        when(users.findByEmail("an@example.com")).thenReturn(Optional.of(existing));
        assertThat(google.login("tok").user().userId()).isEqualTo(existing.getUserId().toString());
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void refusesToLogStaffAccountsInThroughGoogle() {
        for (String role : new String[]{"officer", "admin"}) {
            User staff = new User("Staff", "staff@example.com", "hash", role, null);
            staff.setUserId(UUID.randomUUID());
            when(verifier.verify("tok")).thenReturn(new FirebaseIdTokenVerifier.GoogleIdentity("staff@example.com", "Staff"));
            when(users.findByEmail("staff@example.com")).thenReturn(Optional.of(staff));
            assertThatThrownBy(() -> google.login("tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(403));
        }
    }
}
