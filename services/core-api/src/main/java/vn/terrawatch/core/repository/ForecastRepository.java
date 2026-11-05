package vn.terrawatch.core.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import vn.terrawatch.core.dto.ForecastReviewItem;
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
            SELECT f.run_id, f.unit_id, u.unit_name, f.unit_version, f.hazard_level::text AS hazard_level, f.probability,
                   f.issued_at, f.valid_from, f.valid_until, f.model_version, ST_AsGeoJSON(u.geom) AS geometry
            FROM core_schema.forecast_runs f
            JOIN gis_schema.spatial_assessment_units u ON u.unit_id = f.unit_id
            WHERE f.review_status = 'approved' AND f.is_active = TRUE AND f.availability = 'available'
              AND u.is_active = TRUE AND f.valid_until > CURRENT_TIMESTAMP
            ORDER BY f.valid_until, f.run_id
            """, this::zone);
    }

    /**
     * Forecast proposals for officers. status = pending | approved | rejected | all; reviewed ones only for the last
     * 7 days. shortcut: 3 evidence queries per run (N+1), fine for a queue capped at 100; batch by unit_id if it grows.
     */
    public List<ForecastReviewItem> reviewQueue(String status) {
        String filter = "all".equals(status)
            ? "(f.review_status = 'pending' OR f.issued_at > now() - interval '7 days')"
            : "pending".equals(status) ? "f.review_status = 'pending'"
            : "f.review_status = '" + status + "' AND f.issued_at > now() - interval '7 days'"; // status is whitelisted by the caller
        List<ForecastReviewItem> items = jdbc.query("""
            SELECT f.run_id, f.hazard_level::text AS hazard_level, f.probability, f.experimental_score, f.issued_at,
                   f.valid_from, f.valid_until, f.horizon_hours, f.availability, f.unavailability_reason,
                   f.review_status::text AS review_status, f.model_version, f.threshold_version,
                   f.contributing_factors::text AS contributing_factors, f.input_quality::text AS input_quality,
                   f.unit_id, f.unit_version, u.unit_name, u.admin_province, u.admin_district, u.admin_commune,
                   u.slope_avg, u.slope_max, u.elevation_avg, u.relief_m, u.effective_resolution_m,
                   ST_X(u.centroid) AS lng, ST_Y(u.centroid) AS lat, ST_AsGeoJSON(u.geom) AS geometry, u.area_id
            FROM core_schema.forecast_runs f
            JOIN gis_schema.spatial_assessment_units u ON u.unit_id = f.unit_id
            WHERE f.is_active = TRUE AND u.is_active = TRUE AND\s""" + filter + """
             ORDER BY f.valid_until DESC, f.run_id LIMIT 100
            """, this::reviewItem);
        return items.stream().map(i -> i.withEvidence(observedRain(i), forecastRain(i), priorRuns(i))).toList();
    }

    /** Last 24h of observations that were already available when the forecast was issued (as-of, no leakage). */
    private List<ForecastReviewItem.RainObs> observedRain(ForecastReviewItem run) {
        OffsetDateTime at = run.issuedAt().atOffset(java.time.ZoneOffset.UTC);
        return jdbc.query("""
            SELECT interval_start, interval_end, rainfall_mm, quality_flag, source_provider
            FROM gis_schema.rainfall_observations
            WHERE unit_id = ? AND interval_end > CAST(? AS timestamptz) - interval '24 hours' AND interval_end <= ? AND available_at <= ?
            ORDER BY interval_end
            """, (rs, n) -> new ForecastReviewItem.RainObs(instant(rs, "interval_start"), instant(rs, "interval_end"),
                (Double) rs.getObject("rainfall_mm"), rs.getString("quality_flag"), rs.getString("source_provider")),
            run.unit().unitId(), at, at, at);
    }

    private List<ForecastReviewItem.RainFc> forecastRain(ForecastReviewItem run) {
        OffsetDateTime at = run.issuedAt().atOffset(java.time.ZoneOffset.UTC);
        return jdbc.query("""
            SELECT provider_run_id, provider_name, issued_at, valid_from, valid_until, predicted_rain_24h_mm, quality_flag
            FROM gis_schema.rainfall_forecasts
            WHERE unit_id = ? AND available_at <= ? AND valid_until > ?
            ORDER BY issued_at DESC LIMIT 5
            """, (rs, n) -> new ForecastReviewItem.RainFc(rs.getString("provider_run_id"), rs.getString("provider_name"),
                instant(rs, "issued_at"), instant(rs, "valid_from"), instant(rs, "valid_until"),
                rs.getDouble("predicted_rain_24h_mm"), rs.getString("quality_flag")),
            run.unit().unitId(), at, at);
    }

    /** Earlier forecast runs of the same unit, for run-to-run comparison. */
    private List<ForecastReviewItem.PriorRun> priorRuns(ForecastReviewItem run) {
        return jdbc.query("""
            SELECT run_id, issued_at, hazard_level::text AS hazard_level, probability, review_status::text AS review_status
            FROM core_schema.forecast_runs
            WHERE unit_id = ? AND run_id <> ? AND issued_at < ?
            ORDER BY issued_at DESC LIMIT 5
            """, (rs, n) -> new ForecastReviewItem.PriorRun(rs.getObject("run_id", UUID.class), instant(rs, "issued_at"),
                rs.getString("hazard_level"), (Double) rs.getObject("probability"), rs.getString("review_status")),
            run.unit().unitId(), run.runId(), run.issuedAt().atOffset(java.time.ZoneOffset.UTC));
    }

    private static java.time.Instant instant(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, OffsetDateTime.class).toInstant();
    }

    private ForecastReviewItem reviewItem(ResultSet rs, int row) throws SQLException {
        try {
            var unit = new ForecastReviewItem.Unit(rs.getString("unit_id"), rs.getString("unit_version"),
                rs.getString("unit_name"), rs.getString("admin_province"), rs.getString("admin_district"),
                rs.getString("admin_commune"), (Double) rs.getObject("slope_avg"), (Double) rs.getObject("slope_max"),
                (Double) rs.getObject("elevation_avg"), (Double) rs.getObject("relief_m"),
                (Double) rs.getObject("effective_resolution_m"), (Double) rs.getObject("lng"), (Double) rs.getObject("lat"),
                json.readTree(rs.getString("geometry")), (Integer) rs.getObject("area_id"));
            var validUntil = instant(rs, "valid_until");
            return new ForecastReviewItem(rs.getObject("run_id", UUID.class), rs.getString("hazard_level"),
                (Double) rs.getObject("probability"), (Double) rs.getObject("experimental_score"),
                instant(rs, "issued_at"), instant(rs, "valid_from"), validUntil, rs.getInt("horizon_hours"),
                rs.getString("availability"), rs.getString("unavailability_reason"), rs.getString("review_status"),
                validUntil.isBefore(java.time.Instant.now()), rs.getString("model_version"),
                rs.getString("threshold_version"), jsonOrNull(rs.getString("contributing_factors")),
                jsonOrNull(rs.getString("input_quality")), unit, List.of(), List.of(), List.of());
        } catch (JsonProcessingException e) {
            throw new SQLException("Invalid JSON for forecast run " + rs.getObject("run_id"), e);
        }
    }

    private com.fasterxml.jackson.databind.JsonNode jsonOrNull(String text) throws JsonProcessingException {
        return text == null ? null : json.readTree(text);
    }

    private ForecastZoneResponse zone(ResultSet rs, int row) throws SQLException {
        try {
            return new ForecastZoneResponse(
                rs.getObject("run_id", UUID.class), rs.getString("unit_id"), rs.getString("unit_name"),
                rs.getString("unit_version"), rs.getString("hazard_level"), (Double) rs.getObject("probability"),
                rs.getObject("issued_at", OffsetDateTime.class).toInstant(),
                rs.getObject("valid_from", OffsetDateTime.class).toInstant(),
                rs.getObject("valid_until", OffsetDateTime.class).toInstant(),
                rs.getString("model_version"), json.readTree(rs.getString("geometry")));
        } catch (JsonProcessingException e) {
            throw new SQLException("Invalid geometry for unit " + rs.getString("unit_id"), e);
        }
    }
}
