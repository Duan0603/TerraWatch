package vn.terrawatch.core.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.dto.AlertBroadcastResponse;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class BroadcastRepository {
    public record Area(int id, String name) {}

    public record Recipient(UUID userId, String fcmToken) {}

    public record Stored(UUID broadcastId, Instant issuedAt) {}

    public record RunRef(UUID runId, String unitId, OffsetDateTime validUntil) {}

    public record EmailRecipient(UUID userId, String email, String fullName) {}

    private final JdbcTemplate jdbc;

    public BroadcastRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Area> activeAreas() {
        return jdbc.query("SELECT area_id, name FROM gis_schema.monitoring_areas WHERE is_active ORDER BY area_id",
            (rs, i) -> new Area(rs.getInt("area_id"), rs.getString("name")));
    }

    /** Users with an active push subscription to any of the areas, one row per registered phone. */
    public List<Recipient> recipients(List<Integer> areaIds) {
        String in = String.join(",", areaIds.stream().map(a -> "?").toList());
        return jdbc.query("""
            SELECT DISTINCT t.user_id, t.fcm_token
            FROM core_schema.alert_subscriptions s
            JOIN core_schema.device_tokens t ON t.user_id = s.user_id
            WHERE s.is_active AND s.channel_push AND s.area_id IN (%s)
            """.formatted(in), (rs, i) -> new Recipient(rs.getObject("user_id", UUID.class), rs.getString("fcm_token")),
            areaIds.toArray());
    }

    /**
     * Citizens who should receive an email for a broadcast:
     * (1) subscribed to any of the affected areas, OR
     * (2) have their registered province matching any spatial unit in those areas.
     * Union ensures location-registered users without a manual subscription are also notified.
     */
    public List<EmailRecipient> emailRecipients(List<Integer> areaIds) {
        String in = String.join(",", areaIds.stream().map(a -> "?").toList());
        // areaIds is used twice in the UNION — pass it twice as varargs
        Object[] params = java.util.stream.Stream.concat(
            areaIds.stream(), areaIds.stream()).toArray();
        return jdbc.query("""
            SELECT DISTINCT u.user_id, u.email, u.full_name
            FROM core_schema.users u
            WHERE u.role = 'citizen'
              AND (
                -- Kênh 1: đã đăng ký theo dõi vùng bị ảnh hưởng
                EXISTS (
                    SELECT 1 FROM core_schema.alert_subscriptions s
                    WHERE s.user_id = u.user_id AND s.is_active
                      AND s.area_id IN (%1$s)
                )
                OR
                -- Kênh 2: địa chỉ đăng ký nằm trong tỉnh/huyện của vùng bị ảnh hưởng
                EXISTS (
                    SELECT 1 FROM gis_schema.spatial_assessment_units sau
                    WHERE sau.is_active AND sau.area_id IN (%1$s)
                      AND u.province IS NOT NULL AND u.province <> ''
                      AND LOWER(u.province) = LOWER(sau.admin_province)
                )
              )
            """.formatted(in),
            (rs, i) -> new EmailRecipient(rs.getObject("user_id", UUID.class),
                rs.getString("email"), rs.getString("full_name")),
            params);
    }

    /** The forecast a broadcast may cite: approved, active, available and not expired. */
    public java.util.Optional<RunRef> citableRun(UUID runId) {
        return jdbc.query("""
            SELECT run_id, unit_id, valid_until FROM core_schema.forecast_runs
            WHERE run_id = ? AND review_status = 'approved' AND is_active AND availability = 'available' AND valid_until > now()
            """, (rs, i) -> new RunRef(rs.getObject("run_id", UUID.class), rs.getString("unit_id"),
                rs.getObject("valid_until", OffsetDateTime.class)), runId).stream().findFirst();
    }

    public Stored insert(UUID senderId, String title, String message, String severity, int areaId,
                         OffsetDateTime validUntil, int recipients, String idempotencyKey, RunRef run) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.alert_broadcasts (sender_id, title, message, severity, target_channel, area_id, valid_until, total_recipients, idempotency_key, run_id, unit_id)
            VALUES (?, ?, ?, CAST(? AS core_schema.risk_level), 'app_push', ?, ?, ?, ?, ?, ?)
            RETURNING broadcast_id, broadcast_time
            """, (rs, i) -> new Stored(rs.getObject("broadcast_id", UUID.class),
                rs.getObject("broadcast_time", OffsetDateTime.class).toInstant()),
            senderId, title, message, severity, areaId, validUntil, recipients, idempotencyKey,
            run == null ? null : run.runId(), run == null ? null : run.unitId());
    }

    public void insertDelivery(UUID broadcastId, Recipient to, boolean sent, String error) {
        jdbc.update("""
            INSERT INTO core_schema.alert_deliveries (broadcast_id, user_id, fcm_token, status, error_message)
            VALUES (?, ?, ?, CAST(? AS core_schema.alert_delivery_status), ?)
            """, broadcastId, to.userId(), to.fcmToken(), sent ? "sent" : "failed", error);
    }

    public void updateCounts(UUID broadcastId, int sent, int failed) {
        jdbc.update("UPDATE core_schema.alert_broadcasts SET successful_deliveries = ?, failed_deliveries = ? WHERE broadcast_id = ?",
            sent, failed, broadcastId);
    }

    /** Broadcasts addressed to the user in the last 7 days, newest first, whether or not the push arrived. */
    public List<AlertBroadcastResponse> forUser(UUID userId) {
        Instant now = Instant.now();
        return jdbc.query("""
            SELECT b.broadcast_id, b.title, b.message, b.severity::text AS severity, a.name AS area_name,
                   b.broadcast_time, b.valid_until, b.status
            FROM core_schema.alert_broadcasts b
            LEFT JOIN gis_schema.monitoring_areas a ON a.area_id = b.area_id
            WHERE b.broadcast_time > CURRENT_TIMESTAMP - INTERVAL '7 days'
              AND EXISTS (SELECT 1 FROM core_schema.alert_deliveries d WHERE d.broadcast_id = b.broadcast_id AND d.user_id = ?)
            ORDER BY b.broadcast_time DESC
            """, (rs, i) -> {
                OffsetDateTime until = rs.getObject("valid_until", OffsetDateTime.class);
                return new AlertBroadcastResponse(rs.getString("broadcast_id"), rs.getString("title"), rs.getString("message"),
                    rs.getString("severity"), rs.getString("area_name"), rs.getObject("broadcast_time", OffsetDateTime.class).toInstant(),
                    until == null ? null : until.toInstant(), rs.getString("status"), until != null && !until.toInstant().isAfter(now));
            }, userId);
    }

    /** @return false when no active broadcast has that id */
    public boolean revoke(UUID broadcastId) {
        return jdbc.update("UPDATE core_schema.alert_broadcasts SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE broadcast_id = ? AND status = 'active'", broadcastId) == 1;
    }
}

