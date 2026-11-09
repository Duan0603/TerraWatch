package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Story 4.27: append-only log of admin-console actions. */
@Service
public class AdminAuditService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuditService.class);

    private final JdbcTemplate jdbc;

    public AdminAuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Called after the action succeeded. A logging failure must not undo it, but it is never silent. */
    public void record(UUID actorId, String action, String targetType, String targetId, String targetLabel, String detail) {
        try {
            jdbc.update("""
                INSERT INTO core_schema.admin_audit (actor_id, actor_email, action, target_type, target_id, target_label, detail)
                VALUES (?, (SELECT email FROM core_schema.users WHERE user_id = ?), ?, ?, ?, ?, ?)
                """, actorId, actorId, action, targetType, targetId, targetLabel, detail);
        } catch (Exception e) {
            log.error("Could not write admin audit entry {} by {}: {}", action, actorId, e.getMessage());
        }
    }

    public List<Map<String, Object>> list(int limit) {
        int safe = Math.max(1, Math.min(limit, 500));
        return jdbc.query("""
            SELECT audit_id, actor_email, action, target_type, target_id, target_label, detail, created_at
            FROM core_schema.admin_audit ORDER BY created_at DESC, audit_id DESC LIMIT ?
            """, (rs, i) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", rs.getLong("audit_id"));
                m.put("actor", rs.getString("actor_email"));
                m.put("action", rs.getString("action"));
                m.put("targetType", rs.getString("target_type"));
                m.put("targetId", rs.getString("target_id"));
                m.put("targetLabel", rs.getString("target_label"));
                m.put("detail", rs.getString("detail"));
                Timestamp at = rs.getTimestamp("created_at");
                m.put("at", at == null ? null : at.toInstant().toString());
                return m;
            }, safe);
    }
}
