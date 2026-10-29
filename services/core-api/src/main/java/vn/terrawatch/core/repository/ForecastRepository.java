package vn.terrawatch.core.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.dto.ForecastZoneResponse;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class ForecastRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public ForecastRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** Runs a citizen may rely on right now: approved, active, available and not yet expired. */
    public List<ForecastZoneResponse> listApprovedUnexpired() {
        return jdbc.query("""
            SELECT f.run_id, f.unit_id, f.unit_version, f.hazard_level::text AS hazard_level, f.probability,
                   f.issued_at, f.valid_from, f.valid_until, f.model_version, ST_AsGeoJSON(u.geom) AS geometry
            FROM core_schema.forecast_runs f
            JOIN gis_schema.spatial_assessment_units u ON u.unit_id = f.unit_id
            WHERE f.review_status = 'approved' AND f.is_active = TRUE AND f.availability = 'available'
              AND u.is_active = TRUE AND f.valid_until > CURRENT_TIMESTAMP
            ORDER BY f.valid_until, f.run_id
            """, this::zone);
    }

    private ForecastZoneResponse zone(ResultSet rs, int row) throws SQLException {
        try {
            return new ForecastZoneResponse(
                rs.getObject("run_id", UUID.class), rs.getString("unit_id"), rs.getString("unit_version"),
                rs.getString("hazard_level"), (Double) rs.getObject("probability"),
                rs.getObject("issued_at", OffsetDateTime.class).toInstant(),
                rs.getObject("valid_from", OffsetDateTime.class).toInstant(),
                rs.getObject("valid_until", OffsetDateTime.class).toInstant(),
                rs.getString("model_version"), json.readTree(rs.getString("geometry")));
        } catch (JsonProcessingException e) {
            throw new SQLException("Invalid geometry for unit " + rs.getString("unit_id"), e);
        }
    }
}
