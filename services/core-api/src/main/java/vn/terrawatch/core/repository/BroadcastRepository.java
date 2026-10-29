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

    public Stored insert(UUID senderId, String title, String message, String severity, int areaId,
                         OffsetDateTime validUntil, int recipients) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.alert_broadcasts (sender_id, title, message, severity, target_channel, area_id, valid_until, total_recipients)
            VALUES (?, ?, ?, CAST(? AS core_schema.risk_level), 'app_push', ?, ?, ?)
            RETURNING broadcast_id, broadcast_time
            """, (rs, i) -> new Stored(rs.getObject("broadcast_id", UUID.class),
                rs.getObject("broadcast_time", OffsetDateTime.class).toInstant()),
            senderId, title, message, severity, areaId, validUntil, recipients);
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
