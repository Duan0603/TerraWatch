package vn.terrawatch.core.security;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Branches of the filter that turns a Bearer token into a signed-in user, with the user store mocked. */
class JwtAuthenticationFilterTest {
    private final JwtTokenProvider tokens = new JwtTokenProvider("test-only-secret-at-least-thirty-two-bytes-long", 60_000);
    private final UserRepository users = mock(UserRepository.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokens, users);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private User user(String role) {
        User u = new User("Filter Test", "filter@example.com", "hash", role, null);
        u.setUserId(UUID.randomUUID());
        return u;
    }

    /** Runs the filter and returns the chain, which records that the request was passed on. */
    private MockFilterChain run(String authorization) throws ServletException, IOException {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (authorization != null) request.addHeader("Authorization", authorization);
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, new MockHttpServletResponse(), chain);
        return chain;
    }

    private static List<String> authorities(Authentication auth) {
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).toList();
    }

    @Test
    void requestWithoutCredentialsIsPassedOnAnonymousAndNeverTouchesTheUserStore() throws Exception {
        MockFilterChain chain = run(null);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void anotherAuthorizationSchemeIsIgnoredEvenWithAValidTokenInIt() throws Exception {
        User u = user("admin");

        MockFilterChain chain = run("Basic " + tokens.generateToken(u));

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void schemeNameIsCaseInsensitiveAndPrincipalIsTheUserIdWithNoCredentials() throws Exception {
        User u = user("citizen");
        when(users.findById(u.getUserId())).thenReturn(Optional.of(u));

        MockFilterChain chain = run("bEaReR " + tokens.generateToken(u));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(chain.getRequest()).isNotNull();
        assertThat(auth.isAuthenticated()).isTrue();
        assertThat(auth.getPrincipal()).isEqualTo(u.getUserId());
        assertThat(auth.getCredentials()).isNull();
        assertThat(authorities(auth)).containsExactly("ROLE_CITIZEN");
        verify(users).findById(u.getUserId());
    }

    @Test
    void authorityComesFromTheRoleStoredNowNotFromTheRoleFrozenInTheToken() throws Exception {
        User issuedAs = user("admin");
        String token = tokens.generateToken(issuedAs);
        User demoted = user("officer");
        demoted.setUserId(issuedAs.getUserId());
        when(users.findById(issuedAs.getUserId())).thenReturn(Optional.of(demoted));

        run("Bearer " + token);

        assertThat(authorities(SecurityContextHolder.getContext().getAuthentication())).containsExactly("ROLE_OFFICER");
    }

    @Test
    void approvalStatusIsComparedIgnoringCase() throws Exception {
        User u = user("officer");
        u.setApprovalStatus("APPROVED");
        when(users.findById(u.getUserId())).thenReturn(Optional.of(u));

        run("Bearer " + tokens.generateToken(u));

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }

    @ParameterizedTest(name = "stored account {0} / approval {1} / active {2} is refused")
    @CsvSource({
        "citizen, pending,  true",
        "citizen, rejected, true",
        "citizen, approved, false",
        "superuser, approved, true"
    })
    void accountThatIsNotAllowedToSignInGetsNoAuthenticationButTheRequestStillContinues(String role, String approval, boolean active) throws Exception {
        User issuedAs = user("citizen");
        String token = tokens.generateToken(issuedAs);
        User stored = user(role);
        stored.setUserId(issuedAs.getUserId());
        stored.setApprovalStatus(approval);
        stored.setActive(active);
        when(users.findById(issuedAs.getUserId())).thenReturn(Optional.of(stored));

        MockFilterChain chain = run("Bearer " + token);

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void tokenOfADeletedAccountGetsNoAuthentication() throws Exception {
        User u = user("citizen");
        when(users.findById(u.getUserId())).thenReturn(Optional.empty());

        MockFilterChain chain = run("Bearer " + tokens.generateToken(u));

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void tokenWithAnUnknownRoleOrBlankEmailIsRejectedBeforeTheUserStoreIsAsked() throws Exception {
        User unknownRole = user("superuser");
        User blankEmail = user("citizen");
        blankEmail.setEmail("  ");

        run("Bearer " + tokens.generateToken(unknownRole));
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        run("Bearer " + tokens.generateToken(blankEmail));
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();

        verifyNoInteractions(users);
    }

    @Test
    void anInvalidTokenEvictsAnAuthenticationAlreadyInTheContext() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(UUID.randomUUID(), null, List.of()));

        MockFilterChain chain = run("Bearer not-a-jwt");

        assertThat(chain.getRequest()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
