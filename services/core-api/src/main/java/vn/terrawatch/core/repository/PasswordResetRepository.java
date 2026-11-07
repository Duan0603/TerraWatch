package vn.terrawatch.core.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Story 4.21: e-mailed reset codes. Only hashes are stored. */
@Repository
public class PasswordResetRepository {
    public record Row(UUID resetId, String codeHash, String tokenHash, int attempts, OffsetDateTime expiresAt,
                      OffsetDateTime verifiedAt, OffsetDateTime usedAt, OffsetDateTime createdAt) {}

    private final JdbcTemplate jdbc;

    public PasswordResetRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Row latest(UUID userId) {
        List<Row> rows = jdbc.query("""
            SELECT reset_id, code_hash, reset_token_hash, attempts, expires_at, verified_at, used_at, created_at
            FROM core_schema.password_reset_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
            """, (rs, i) -> new Row(rs.getObject("reset_id", UUID.class), rs.getString("code_hash"),
                rs.getString("reset_token_hash"), rs.getInt("attempts"), rs.getObject("expires_at", OffsetDateTime.class),
                rs.getObject("verified_at", OffsetDateTime.class), rs.getObject("used_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class)), userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public int countSince(UUID userId, OffsetDateTime since) {
        Integer n = jdbc.queryForObject(
            "SELECT count(*) FROM core_schema.password_reset_codes WHERE user_id = ? AND created_at >= ?",
            Integer.class, userId, since);
        return n == null ? 0 : n;
    }

    public void insert(UUID userId, String codeHash, OffsetDateTime expiresAt) {
        jdbc.update("INSERT INTO core_schema.password_reset_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
            userId, codeHash, expiresAt);
    }

    public void addAttempt(UUID resetId) {
        jdbc.update("UPDATE core_schema.password_reset_codes SET attempts = attempts + 1 WHERE reset_id = ?", resetId);
    }

    public void markVerified(UUID resetId, String tokenHash, OffsetDateTime newExpiry) {
        jdbc.update("""
            UPDATE core_schema.password_reset_codes
            SET verified_at = now(), reset_token_hash = ?, expires_at = ? WHERE reset_id = ?
            """, tokenHash, newExpiry, resetId);
    }

    public void markUsed(UUID resetId) {
        jdbc.update("UPDATE core_schema.password_reset_codes SET used_at = now() WHERE reset_id = ?", resetId);
    }
}
