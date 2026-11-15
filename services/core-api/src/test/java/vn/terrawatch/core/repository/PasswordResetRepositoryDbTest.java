package vn.terrawatch.core.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** {@link PasswordResetRepository} against the real {@code password_reset_codes} table. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PasswordResetRepositoryDbTest {
    private static final OffsetDateTime EXPIRES = OffsetDateTime.parse("2031-06-01T12:00:00Z");

    private PasswordResetRepository resets;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void repository() {
        resets = new PasswordResetRepository(jdbc);
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO core_schema.users (user_id, full_name, email, password_hash) VALUES (?, 'U', ?, 'x')", id, id + "@reset-db.example");
        return id;
    }

    /** Inserts a code and backdates created_at, because now() is frozen at the transaction start. */
    private UUID code(UUID userId, String hash, OffsetDateTime createdAt) {
        resets.insert(userId, hash, EXPIRES);
        UUID id = jdbc.queryForObject("SELECT reset_id FROM core_schema.password_reset_codes WHERE user_id = ? AND code_hash = ?", UUID.class, userId, hash);
        jdbc.update("UPDATE core_schema.password_reset_codes SET created_at = ? WHERE reset_id = ?", createdAt, id);
        return id;
    }

    @Test
    void latestIsNullWhenTheUserNeverRequestedACode() {
        assertThat(resets.latest(user())).isNull();
    }

    @Test
    void insertCreatesAFreshUnverifiedUnusedRowWithZeroAttempts() {
        UUID userId = user();

        resets.insert(userId, "bcrypt-hash", EXPIRES);

        PasswordResetRepository.Row row = resets.latest(userId);
        assertThat(row.resetId()).isNotNull();
        assertThat(row.codeHash()).isEqualTo("bcrypt-hash");
        assertThat(row.tokenHash()).isNull();
        assertThat(row.attempts()).isZero();
        assertThat(row.expiresAt().toInstant()).isEqualTo(EXPIRES.toInstant());
        assertThat(row.verifiedAt()).isNull();
        assertThat(row.usedAt()).isNull();
        assertThat(row.createdAt()).isNotNull();
    }

    @Test
    void latestPicksTheNewestCodeOfThatUserOnly() {
        UUID userId = user();
        UUID other = user();
        code(userId, "old", OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        code(userId, "new", OffsetDateTime.parse("2026-01-03T00:00:00Z"));
        code(userId, "mid", OffsetDateTime.parse("2026-01-02T00:00:00Z"));
        code(other, "other-newest", OffsetDateTime.parse("2026-02-01T00:00:00Z"));

        assertThat(resets.latest(userId).codeHash()).isEqualTo("new");
    }

    @Test
    void countSinceIncludesTheExactCutoffAndExcludesOlderRowsAndOtherUsers() {
        UUID userId = user();
        OffsetDateTime cutoff = OffsetDateTime.parse("2026-03-01T10:00:00Z");
        code(userId, "just-before", cutoff.minusNanos(1_000));
        code(userId, "at-cutoff", cutoff);
        code(userId, "after", cutoff.plusMinutes(5));
        code(user(), "someone-else", cutoff.plusMinutes(5));

        assertThat(resets.countSince(userId, cutoff)).isEqualTo(2);
        assertThat(resets.countSince(userId, cutoff.plusNanos(1_000))).isEqualTo(1);
        assertThat(resets.countSince(userId, cutoff.plusDays(1))).isZero();
        assertThat(resets.countSince(user(), cutoff.minusYears(10))).isZero();
    }

    @Test
    void addAttemptIncrementsOnlyTheTargetedRow() {
        UUID userId = user();
        UUID target = code(userId, "a", OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        UUID untouched = code(userId, "b", OffsetDateTime.parse("2026-01-02T00:00:00Z"));

        resets.addAttempt(target);
        resets.addAttempt(target);
        resets.addAttempt(target);

        assertThat(jdbc.queryForObject("SELECT attempts FROM core_schema.password_reset_codes WHERE reset_id = ?", Integer.class, target)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT attempts FROM core_schema.password_reset_codes WHERE reset_id = ?", Integer.class, untouched)).isZero();
    }

    @Test
    void markVerifiedStampsTheTimeStoresTheTokenHashAndMovesTheExpiry() {
        UUID userId = user();
        UUID id = code(userId, "a", OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        OffsetDateTime newExpiry = EXPIRES.plusMinutes(10);

        resets.markVerified(id, "sha256-token", newExpiry);

        PasswordResetRepository.Row row = resets.latest(userId);
        assertThat(row.tokenHash()).isEqualTo("sha256-token");
        assertThat(row.expiresAt().toInstant()).isEqualTo(newExpiry.toInstant());
        assertThat(row.verifiedAt()).isNotNull();
        assertThat(row.usedAt()).isNull();
        assertThat(row.codeHash()).isEqualTo("a");
    }

    @Test
    void markUsedStampsUsedAtOnlyOnTheTargetedRow() {
        UUID userId = user();
        UUID used = code(userId, "a", OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        UUID unused = code(userId, "b", OffsetDateTime.parse("2026-01-02T00:00:00Z"));

        resets.markUsed(used);

        assertThat(jdbc.queryForObject("SELECT used_at IS NOT NULL FROM core_schema.password_reset_codes WHERE reset_id = ?", Boolean.class, used)).isTrue();
        assertThat(jdbc.queryForObject("SELECT used_at IS NULL FROM core_schema.password_reset_codes WHERE reset_id = ?", Boolean.class, unused)).isTrue();
    }

    @Test
    void mutatorsOnAnUnknownIdChangeNothingAndDoNotThrow() {
        UUID userId = user();
        UUID id = code(userId, "a", OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        UUID ghost = UUID.randomUUID();

        resets.addAttempt(ghost);
        resets.markVerified(ghost, "t", EXPIRES);
        resets.markUsed(ghost);

        PasswordResetRepository.Row row = resets.latest(userId);
        assertThat(row.resetId()).isEqualTo(id);
        assertThat(row.attempts()).isZero();
        assertThat(row.verifiedAt()).isNull();
        assertThat(row.usedAt()).isNull();
    }

    @Test
    void insertForAnUnknownUserViolatesTheForeignKey() {
        UUID ghost = UUID.randomUUID();
        assertThatThrownBy(() -> resets.insert(ghost, "h", EXPIRES)).isInstanceOf(DataAccessException.class);
    }

    @Test
    void codesAreDeletedWithTheirUser() {
        UUID userId = user();
        resets.insert(userId, "h", EXPIRES);

        jdbc.update("DELETE FROM core_schema.users WHERE user_id = ?", userId);

        assertThat(resets.countSince(userId, OffsetDateTime.parse("2000-01-01T00:00:00Z"))).isZero();
    }
}
