package vn.terrawatch.core.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public class DeviceTokenRepository {
    private final JdbcTemplate jdbc;

    public DeviceTokenRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Registers the token for the user; if another account held it (shared phone) it moves here. */
    public void register(UUID userId, String fcmToken, String deviceType) {
        jdbc.update("""
            INSERT INTO core_schema.device_tokens (fcm_token, user_id, device_type) VALUES (?, ?, ?)
            ON CONFLICT (fcm_token) DO UPDATE SET user_id = EXCLUDED.user_id, device_type = EXCLUDED.device_type,
                                                  registered_at = CURRENT_TIMESTAMP
            """, fcmToken, userId, deviceType);
    }

    /** Removes the user's own token only. */
    public void remove(UUID userId, String fcmToken) {
        jdbc.update("DELETE FROM core_schema.device_tokens WHERE fcm_token = ? AND user_id = ?", fcmToken, userId);
    }

    /** Drops a token FCM reported as no longer valid. */
    public void forget(String fcmToken) {
        jdbc.update("DELETE FROM core_schema.device_tokens WHERE fcm_token = ?", fcmToken);
    }
}
