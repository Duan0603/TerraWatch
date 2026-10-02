package vn.terrawatch.core.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class SpatialRepository {

    private final JdbcTemplate jdbcTemplate;

    public SpatialRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // FR3.1: Hàng đợi thẩm định (Verification Queue)
    public List<Map<String, Object>> getVerificationQueue() {
        String sql = """
            SELECT 
                event_id,
                detection_date,
                risk_level,
                status,
                confidence_score,
                slope_degrees,
                ndvi_drop,
                affected_area_m2,
                satellite_scene_id,
                ST_AsGeoJSON(geom) AS geometry_geojson,
                ST_AsGeoJSON(centroid) AS centroid_geojson
            FROM core_schema.landslide_events
            WHERE status = 'pending'
            ORDER BY confidence_score DESC, detection_date DESC
            """;
        return jdbcTemplate.queryForList(sql);
    }

    // FR3.2 & UC04: Cán bộ phê duyệt / Bác bỏ
    public Map<String, Object> verifyEvent(UUID eventId, UUID officerId, String status, String riskLevel, String officerNote) {
        String sql = """
            UPDATE core_schema.landslide_events
            SET 
                status = CAST(? AS core_schema.verification_status),
                risk_level = CASE WHEN ? IS NOT NULL THEN CAST(? AS core_schema.risk_level) ELSE risk_level END,
                officer_note = ?,
                verified_by = ?,
                verified_at = CURRENT_TIMESTAMP
            WHERE event_id = ?
            RETURNING 
                event_id,
                status,
                risk_level,
                affected_area_m2,
                verified_at
            """;
        return jdbcTemplate.queryForMap(sql, status, riskLevel, riskLevel, officerNote, officerId, eventId);
    }

    // UC05: Bản đồ WebGIS các điểm đã thẩm định
    public String getActiveVerifiedEventsGeoJson() {
        String sql = """
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'id', event_id,
                        'geometry', ST_AsGeoJSON(geom)::jsonb,
                        'properties', jsonb_build_object(
                            'event_id', event_id,
                            'risk_level', risk_level,
                            'confidence', confidence_score,
                            'area_m2', affected_area_m2,
                            'slope', slope_degrees,
                            'verified_at', verified_at,
                            'scene_id', satellite_scene_id
                        )
                    )
                ), '[]'::jsonb)
            )::text AS geojson
            FROM core_schema.landslide_events
            WHERE status = 'verified'
            """;
        return jdbcTemplate.queryForObject(sql, String.class);
    }

    // UC08 & NFR2: Truy vấn Geofencing (bán kính meters)
    public List<Map<String, Object>> queryGeofence(double lon, double lat, double radiusMeters) {
        String sql = """
            SELECT 
                event_id, 
                risk_level,
                affected_area_m2,
                ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) AS distance_meters
            FROM core_schema.landslide_events 
            WHERE ST_DWithin(
                geom::geography, 
                ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 
                ?
            ) AND status = 'verified'
            ORDER BY distance_meters ASC
            """;
        return jdbcTemplate.queryForList(sql, lon, lat, lon, lat, radiusMeters);
    }

    // UC08: Xuất dữ liệu đồng bộ ngoại tuyến (Offline GeoJSON Sync)
    public String exportOfflineSyncGeoJson() {
        String sql = """
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'id', t.event_id,
                        'geometry', ST_AsGeoJSON(t.geom)::jsonb,
                        'properties', jsonb_build_object(
                            'event_id', t.event_id,
                            'risk_level', t.risk_level
                        )
                    )
                ), '[]'::jsonb)
            )::text AS geojson
            FROM (SELECT event_id, risk_level, geom FROM core_schema.landslide_events WHERE status = 'verified') AS t
            """;
        return jdbcTemplate.queryForObject(sql, String.class);
    }

    // Monitoring Areas (gis_schema)
    public List<Map<String, Object>> listMonitoringAreas() {
        String sql = """
            SELECT 
                area_id, 
                name, 
                description, 
                is_active, 
                ST_AsGeoJSON(geom) AS geometry_geojson,
                created_at
            FROM gis_schema.monitoring_areas
            ORDER BY area_id ASC
            """;
        return jdbcTemplate.queryForList(sql);
    }

    public Map<String, Object> createMonitoringArea(String name, String description, String geoJsonGeometry) {
        String sql = """
            INSERT INTO gis_schema.monitoring_areas (name, description, geom)
            VALUES (?, ?, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)))
            RETURNING area_id, name, description, is_active, created_at
            """;
        return jdbcTemplate.queryForMap(sql, name, description, geoJsonGeometry);
    }

    // Community Reports (core_schema)
    public Map<String, Object> submitCommunityReport(UUID userId, double lon, double lat, String imageUrl, String description) {
        String sql = """
            INSERT INTO core_schema.community_reports (user_id, location, image_url, description, status)
            VALUES (?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, 'submitted')
            RETURNING report_id, user_id, report_time, image_url, description, status
            """;
        return jdbcTemplate.queryForMap(sql, userId, lon, lat, imageUrl, description);
    }

    public List<Map<String, Object>> listCommunityReports() {
        String sql = """
            SELECT 
                r.report_id,
                r.report_time,
                r.image_url,
                r.description,
                r.status,
                ST_X(r.location) AS longitude,
                ST_Y(r.location) AS latitude,
                u.full_name AS submitter_name
            FROM core_schema.community_reports r
            LEFT JOIN core_schema.users u ON r.user_id = u.user_id
            ORDER BY r.report_time DESC
            """;
        return jdbcTemplate.queryForList(sql);
    }
}
