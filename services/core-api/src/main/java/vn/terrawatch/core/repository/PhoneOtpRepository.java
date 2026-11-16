package vn.terrawatch.core.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Story 4.44: phone codes sent by our own SMS. Only hashes are stored. */
@Repository
public class PhoneOtpRepository {
    public record Row(UUID otpId, String codeHash, int attempts, OffsetDateTime expiresAt, OffsetDateTime verifiedAt,
                      OffsetDateTime createdAt) {}

    private final JdbcTemplate jdbc;

    public PhoneOtpRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Row latest(String phone) {
        List<Row> rows = jdbc.query("""
            SELECT otp_id, code_hash, attempts, expires_at, verified_at, created_at
            FROM core_schema.phone_otp_codes WHERE phone = ? ORDER BY created_at DESC LIMIT 1
            """, (rs, i) -> new Row(rs.getObject("otp_id", UUID.class), rs.getString("code_hash"), rs.getInt("attempts"),
                rs.getObject("expires_at", OffsetDateTime.class), rs.getObject("verified_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class)), phone);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Codes since then, for one phone or (phone null) for everyone. */
    public int countSince(String phone, OffsetDateTime since) {
        Integer n = phone == null
            ? jdbc.queryForObject("SELECT count(*) FROM core_schema.phone_otp_codes WHERE created_at >= ?", Integer.class, since)
            : jdbc.queryForObject("SELECT count(*) FROM core_schema.phone_otp_codes WHERE phone = ? AND created_at >= ?",
                Integer.class, phone, since);
        return n == null ? 0 : n;
    }

    public UUID insert(String phone, String codeHash, OffsetDateTime expiresAt) {
        return jdbc.queryForObject("INSERT INTO core_schema.phone_otp_codes (phone, code_hash, expires_at) VALUES (?, ?, ?) RETURNING otp_id",
            UUID.class, phone, codeHash, expiresAt);
    }

    public void delete(UUID otpId) {
        jdbc.update("DELETE FROM core_schema.phone_otp_codes WHERE otp_id = ?", otpId);
    }

    public void addAttempt(UUID otpId) {
        jdbc.update("UPDATE core_schema.phone_otp_codes SET attempts = attempts + 1 WHERE otp_id = ?", otpId);
    }

    public void markVerified(UUID otpId, String tokenHash, OffsetDateTime newExpiry) {
        jdbc.update("UPDATE core_schema.phone_otp_codes SET verified_at = now(), token_hash = ?, expires_at = ? WHERE otp_id = ?",
            tokenHash, newExpiry, otpId);
    }

    /** Uses up a live token in one statement (no double use); returns its phone, or null when no such live token. */
    public String consume(String tokenHash) {
        List<String> phones = jdbc.queryForList("""
            UPDATE core_schema.phone_otp_codes SET used_at = now()
            WHERE token_hash = ? AND verified_at IS NOT NULL AND used_at IS NULL AND expires_at > now()
            RETURNING phone
            """, String.class, tokenHash);
        return phones.isEmpty() ? null : phones.get(0);
    }
}
