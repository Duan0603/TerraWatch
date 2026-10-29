package vn.terrawatch.core.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.dto.FieldReportResponse;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Field reports written by the mobile app (PostGIS point + photo + occurrence time). */
@Repository
public class FieldReportRepository {
    private static final String SELECT = """
        SELECT r.report_id, r.client_report_id, r.status::text AS status, r.report_time, r.observed_at,
               r.observed_until, r.description, r.image_url, ST_Y(r.location) AS latitude, ST_X(r.location) AS longitude
        FROM core_schema.community_reports r
        """;

    private final JdbcTemplate jdbc;

    public FieldReportRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** True when a new row was created; false when this user already sent this client report id. */
    public boolean insertIfAbsent(UUID userId, CommunityReportRequest r, String imageUrl) {
        int rows = jdbc.update("""
            INSERT INTO core_schema.community_reports
                (user_id, client_report_id, location, location_accuracy_m, description, photo_id, image_url,
                 observed_at, observed_until, source, status)
            VALUES (?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, ?, ?, ?, ?, 'mobile', 'submitted')
            ON CONFLICT (user_id, client_report_id) WHERE client_report_id IS NOT NULL DO NOTHING
            """,
            userId, r.clientReportId(), r.longitude(), r.latitude(), r.accuracyM(), r.description(), r.photoId(),
            imageUrl, r.observedAt(), r.observedUntil());
        return rows == 1;
    }

    public FieldReportResponse findByClientId(UUID userId, UUID clientReportId) {
        return jdbc.queryForObject(SELECT + " WHERE r.user_id = ? AND r.client_report_id = ?",
            FieldReportRepository::map, userId, clientReportId);
    }

    public List<FieldReportResponse> listByUser(UUID userId) {
        return jdbc.query(SELECT + " WHERE r.user_id = ? ORDER BY r.report_time DESC", FieldReportRepository::map, userId);
    }

    private static FieldReportResponse map(ResultSet rs, int row) throws SQLException {
        return new FieldReportResponse(rs.getInt("report_id"), text(rs.getObject("client_report_id")), rs.getString("status"),
            text(rs.getObject("report_time", OffsetDateTime.class)), text(rs.getObject("observed_at", OffsetDateTime.class)),
            text(rs.getObject("observed_until", OffsetDateTime.class)), rs.getString("description"), rs.getString("image_url"),
            rs.getDouble("latitude"), rs.getDouble("longitude"));
    }

    private static String text(Object value) {
        return value == null ? null : value.toString();
    }
}
