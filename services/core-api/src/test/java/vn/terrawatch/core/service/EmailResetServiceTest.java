package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.PasswordResetRepository;
import vn.terrawatch.core.repository.PasswordResetRepository.Row;
import vn.terrawatch.core.repository.UserRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests with mocked repositories and mailer. The end-to-end flow, resend/hour limits and attempt lock
 * live in EmailResetApiTest and EmailResetLimitsTest; this class covers what those do not reach:
 * mail failure, input normalisation, what is stored, and the complete() guards.
 */
class EmailResetServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordResetRepository resets = mock(PasswordResetRepository.class);
    private final PasswordResetMailer mailer = mock(PasswordResetMailer.class);
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(4);
    private final EmailResetService service = new EmailResetService(users, resets, mailer, passwords);
    private final UUID uid = UUID.randomUUID();

    private User account(boolean active, String provider) {
        User u = new User("An", "an@x.vn", "oldhash", "citizen", null);
        u.setUserId(uid);
        u.setActive(active);
        u.setAuthProvider(provider);
        when(users.findByEmail("an@x.vn")).thenReturn(Optional.of(u));
        return u;
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    private static String sha256(String s) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
    }

    private static Row row(String codeHash, String tokenHash, int attempts, OffsetDateTime expires,
                           OffsetDateTime verified, OffsetDateTime used) {
        return new Row(UUID.randomUUID(), codeHash, tokenHash, attempts, expires, verified, used, OffsetDateTime.now().minusMinutes(2));
    }

    // ---- request ----

    @Test
    void requestStoresOnlyAHashOfTheSixDigitCodeThatWasMailed() {
        account(true, "email");
        when(resets.latest(uid)).thenReturn(null);
        when(mailer.configured()).thenReturn(true);

        service.request("  AN@X.vn ");

        ArgumentCaptor<String> sent = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> stored = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendCode(eq("an@x.vn"), eq("An"), sent.capture(), eq(10));
        verify(resets).insert(eq(uid), stored.capture(), any(OffsetDateTime.class));
        assertThat(sent.getValue()).matches("\\d{6}");
        assertThat(stored.getValue()).isNotEqualTo(sent.getValue());
        assertThat(passwords.matches(sent.getValue(), stored.getValue())).isTrue();
    }

    @Test
    void mailerFailureAfterTheCodeIsStoredIs503() {
        account(true, "email");
        when(mailer.configured()).thenReturn(true);
        doThrow(new IllegalStateException("smtp down")).when(mailer).sendCode(anyString(), anyString(), anyString(), anyInt());

        assertStatus(() -> service.request("an@x.vn"), 503);
    }

    @Test
    void requestIsSilentForUnknownEmailNullEmailAndNonEmailAccounts() {
        when(mailer.configured()).thenReturn(true);
        when(users.findByEmail("")).thenReturn(Optional.empty());
        service.request(null);
        account(true, "google");
        service.request("an@x.vn");
        verify(mailer, never()).sendCode(anyString(), anyString(), anyString(), anyInt());
        verify(resets, never()).insert(any(), anyString(), any());
    }

    @Test
    void requestWithMailNotConfiguredFailsBeforeAnyLookup() {
        when(mailer.configured()).thenReturn(false);
        assertStatus(() -> service.request("an@x.vn"), 503);
        verifyNoInteractions(users, resets);
    }

    // ---- verify ----

    @Test
    void verifyTrimsTheCodeAndStoresOnlyTheTokenHash() throws Exception {
        account(true, "email");
        Row r = row(passwords.encode("123456"), null, 0, OffsetDateTime.now().plusMinutes(5), null, null);
        when(resets.latest(uid)).thenReturn(r);

        String token = service.verify("an@x.vn", " 123456 ");

        assertThat(token).hasSizeGreaterThanOrEqualTo(40).doesNotContain("=");
        verify(resets).markVerified(eq(r.resetId()), eq(sha256(token)), any(OffsetDateTime.class));
        verify(resets, never()).addAttempt(any());
    }

    @Test
    void wrongOrNullCodeCountsAnAttemptAndGivesTheGenericError() {
        account(true, "email");
        Row r = row(passwords.encode("123456"), null, 2, OffsetDateTime.now().plusMinutes(5), null, null);
        when(resets.latest(uid)).thenReturn(r);

        assertStatus(() -> service.verify("an@x.vn", "000000"), 400);
        assertStatus(() -> service.verify("an@x.vn", null), 400);

        verify(resets, org.mockito.Mockito.times(2)).addAttempt(r.resetId());
        verify(resets, never()).markVerified(any(), anyString(), any());
    }

    @Test
    void verifyRefusesUnknownEmailMissingUsedVerifiedExpiredAndLockedCodesWithoutCheckingTheCode() {
        assertStatus(() -> service.verify("ghost@x.vn", "123456"), 400);
        account(true, "email");
        OffsetDateTime later = OffsetDateTime.now().plusMinutes(5);
        String hash = passwords.encode("123456");
        for (Row r : new Row[]{
            null,
            row(hash, null, 0, later, null, OffsetDateTime.now()),
            row(hash, "t", 0, later, OffsetDateTime.now(), null),
            row(hash, null, 0, OffsetDateTime.now().minusSeconds(1), null, null),
            row(hash, null, 5, later, null, null)}) {
            when(resets.latest(uid)).thenReturn(r);
            assertStatus(() -> service.verify("an@x.vn", "123456"), 400);
        }
        verify(resets, never()).addAttempt(any());
        verify(resets, never()).markVerified(any(), anyString(), any());
    }

    // ---- complete ----

    @Test
    void completeSetsTheNewPasswordHashAndBurnsTheCode() throws Exception {
        User u = account(true, "email");
        Row r = row("c", sha256("tok"), 0, OffsetDateTime.now().plusMinutes(5), OffsetDateTime.now(), null);
        when(resets.latest(uid)).thenReturn(r);

        service.complete("an@x.vn", "tok", "brand-new-pass");

        assertThat(passwords.matches("brand-new-pass", u.getPasswordHash())).isTrue();
        verify(users).save(u);
        verify(resets).markUsed(r.resetId());
    }

    @Test
    void completeRefusesPasswordOver72BytesBeforeLookingAnyoneUp() {
        // 37 two-byte chars = 74 bytes but only 37 characters
        String longPassword = "é".repeat(37);
        assertStatus(() -> service.complete("an@x.vn", "tok", longPassword), 400);
        verifyNoInteractions(users, resets);
        // exactly 72 bytes is still accepted by the length guard (fails later, as unknown user)
        assertStatus(() -> service.complete("an@x.vn", "tok", "é".repeat(36)), 400);
        verify(users).findByEmail("an@x.vn");
    }

    @Test
    void completeRefusesWrongNullOrUnverifiedTokenExpiredOrUsedCodeAndLockedAccount() throws Exception {
        User u = account(true, "email");
        OffsetDateTime later = OffsetDateTime.now().plusMinutes(5);
        Row good = row("c", sha256("tok"), 0, later, OffsetDateTime.now(), null);
        when(resets.latest(uid)).thenReturn(good);
        assertStatus(() -> service.complete("an@x.vn", "other", "new-password"), 400);
        assertStatus(() -> service.complete("an@x.vn", null, "new-password"), 400);

        for (Row r : new Row[]{
            null,
            row("c", sha256("tok"), 0, later, null, null),
            row("c", null, 0, later, OffsetDateTime.now(), null),
            row("c", sha256("tok"), 0, later, OffsetDateTime.now(), OffsetDateTime.now()),
            row("c", sha256("tok"), 0, OffsetDateTime.now().minusSeconds(1), OffsetDateTime.now(), null)}) {
            when(resets.latest(uid)).thenReturn(r);
            assertStatus(() -> service.complete("an@x.vn", "tok", "new-password"), 400);
        }

        when(resets.latest(uid)).thenReturn(good);
        u.setActive(false);
        assertStatus(() -> service.complete("an@x.vn", "tok", "new-password"), 400);

        verify(users, never()).save(any());
        verify(resets, never()).markUsed(any());
        assertThat(u.getPasswordHash()).isEqualTo("oldhash");
    }
}
