package vn.terrawatch.core.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Landslide-event queries of {@link SpatialRepository} against real PostGIS: verification queue, officer decision,
 * GeoJSON exports and the geofence. Every test inserts its own rows (around lon 106 / lat 10, away from the seed data),
 * filters results to those rows, and is rolled back.
 */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SpatialRepositoryDbTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final OffsetDateTime T0 = OffsetDateTime.parse("2026-03-01T00:00:00Z");

    private SpatialRepository spatial;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void repository() {
        spatial = new SpatialRepository(jdbc);
    }
    private final Set<UUID> mine = new HashSet<>();

    /** Square of {@code size} degrees whose south-west corner is (lon, lat). */
    private static String square(double lon, double lat, double size) {
        double x2 = lon + size, y2 = lat + size;
        return "MULTIPOLYGON(((%s %s, %s %s, %s %s, %s %s, %s %s)))".formatted(lon, lat, x2, lat, x2, y2, lon, y2, lon, lat);
    }

    private UUID event(String status, String risk, Double confidence, OffsetDateTime detected, String wkt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.landslide_events (event_id, geom, risk_level, status, confidence_score, detection_date, slope_degrees, satellite_scene_id)
            VALUES (?, ST_GeomFromText(?, 4326), CAST(? AS core_schema.risk_level), CAST(? AS core_schema.verification_status), ?, ?, 31.5, 'SCENE-DBTEST')
            """, id, wkt, risk, status, confidence, detected);
        mine.add(id);
        return id;
    }

    private UUID officer() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO core_schema.users (user_id, full_name, email, password_hash) VALUES (?, 'Officer', ?, 'x')",
            id, "officer-" + id + "@spatial-db.example");
        return id;
    }

    private List<UUID> onlyMine(List<Map<String, Object>> rows) {
        List<UUID> ids = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            UUID id = (UUID) row.get("event_id");
            if (mine.contains(id)) ids.add(id);
        }
        return ids;
    }

    private static JsonNode parse(String json) throws Exception {
        return JSON.readTree(json);
    }

    private static List<String> featureIds(JsonNode collection, Set<UUID> wanted) {
        List<String> ids = new ArrayList<>();
        for (JsonNode f : collection.get("features")) {
            if (wanted.contains(UUID.fromString(f.get("id").asText()))) ids.add(f.get("id").asText());
        }
        return ids;
    }

    // ---- getVerificationQueue ----

    @Test
    void queueHoldsOnlyPendingEventsSortedByConfidenceThenNewestDetection() {
        UUID low = event("pending", "low", 0.50, T0, square(106, 10, 0.001));
        UUID tieOld = event("pending", "high", 0.90, T0.minusDays(2), square(106, 10.01, 0.001));
        UUID top = event("pending", "extreme", 0.95, T0.minusDays(5), square(106, 10.02, 0.001));
        UUID tieNew = event("pending", "medium", 0.90, T0, square(106, 10.03, 0.001));
        event("verified", "high", 0.99, T0, square(106, 10.04, 0.001));
        event("rejected", "high", 0.99, T0, square(106, 10.05, 0.001));
        event("false_alarm", "high", 0.99, T0, square(106, 10.06, 0.001));

        assertThat(onlyMine(spatial.getVerificationQueue())).containsExactly(top, tieNew, tieOld, low);
    }

    @Test
    void queueRowCarriesGeoJsonGeometryAndTriggerComputedCentroidAndArea() throws Exception {
        UUID id = event("pending", "high", 0.75, T0, square(106.0, 10.0, 0.01));

        Map<String, Object> row = spatial.getVerificationQueue().stream()
            .filter(r -> id.equals(r.get("event_id"))).findFirst().orElseThrow();

        assertThat(row.keySet()).containsExactlyInAnyOrder("event_id", "detection_date", "risk_level", "status",
            "confidence_score", "slope_degrees", "ndvi_drop", "affected_area_m2", "satellite_scene_id",
            "geometry_geojson", "centroid_geojson");
        assertThat(String.valueOf(row.get("risk_level"))).isEqualTo("high");
        assertThat(String.valueOf(row.get("status"))).isEqualTo("pending");
        assertThat(row.get("confidence_score")).isEqualTo(0.75);
        assertThat(row.get("ndvi_drop")).isNull();
        assertThat(row.get("satellite_scene_id")).isEqualTo("SCENE-DBTEST");
        // 0.01 x 0.01 degrees at lat 10 is about 1.21 km2; the trigger fills the column from the geometry.
        assertThat((Double) row.get("affected_area_m2")).isBetween(1.15e6, 1.25e6);

        JsonNode geometry = parse((String) row.get("geometry_geojson"));
        assertThat(geometry.get("type").asText()).isEqualTo("MultiPolygon");
        assertThat(geometry.has("crs")).isFalse();
        assertThat(geometry.get("coordinates").get(0).get(0)).hasSize(5);
        JsonNode centroid = parse((String) row.get("centroid_geojson"));
        assertThat(centroid.get("type").asText()).isEqualTo("Point");
        assertThat(centroid.get("coordinates").get(0).asDouble()).isCloseTo(106.005, within(1e-6));
        assertThat(centroid.get("coordinates").get(1).asDouble()).isCloseTo(10.005, within(1e-6));
    }

    // ---- verifyEvent ----

    @Test
    void verifyEventUpdatesTheRowAndTheTriggerWritesOneAuditRow() {
        UUID id = event("pending", "medium", 0.8, T0, square(106, 10, 0.001));
        UUID officer = officer();

        Map<String, Object> result = spatial.verifyEvent(id, officer, "verified", "extreme", "slope failed after rain");

        assertThat(result.keySet()).containsExactlyInAnyOrder("event_id", "status", "risk_level", "affected_area_m2", "verified_at");
        assertThat(result.get("event_id")).isEqualTo(id);
        assertThat(String.valueOf(result.get("status"))).isEqualTo("verified");
        assertThat(String.valueOf(result.get("risk_level"))).isEqualTo("extreme");
        assertThat(result.get("verified_at")).isEqualTo(jdbc.queryForObject("SELECT CURRENT_TIMESTAMP", java.sql.Timestamp.class));
        Map<String, Object> stored = jdbc.queryForMap(
            "SELECT officer_note, verified_by FROM core_schema.landslide_events WHERE event_id = ?", id);
        assertThat(stored.get("officer_note")).isEqualTo("slope failed after rain");
        assertThat(stored.get("verified_by")).isEqualTo(officer);
        Map<String, Object> history = jdbc.queryForMap(
            "SELECT previous_status::text AS prev, new_status::text AS next, changed_by, note FROM core_schema.landslide_event_history WHERE event_id = ?", id);
        assertThat(history).containsEntry("prev", "pending").containsEntry("next", "verified")
            .containsEntry("changed_by", officer).containsEntry("note", "slope failed after rain");
    }

    @Test
    void verifyEventWithNullRiskLevelKeepsTheStoredLevel() {
        UUID id = event("pending", "high", 0.8, T0, square(106, 10, 0.001));

        Map<String, Object> result = spatial.verifyEvent(id, officer(), "rejected", null, null);

        assertThat(String.valueOf(result.get("risk_level"))).isEqualTo("high");
        assertThat(String.valueOf(result.get("status"))).isEqualTo("rejected");
        assertThat(jdbc.queryForObject("SELECT officer_note FROM core_schema.landslide_events WHERE event_id = ?", String.class, id)).isNull();
    }

    @Test
    void verifyingTwiceWithTheSameStatusAddsNoSecondAuditRowButRestampsTheDecision() {
        UUID id = event("pending", "low", 0.8, T0, square(106, 10, 0.001));
        UUID first = officer();
        UUID second = officer();

        spatial.verifyEvent(id, first, "verified", "low", "first");
        spatial.verifyEvent(id, second, "verified", "high", "second");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM core_schema.landslide_event_history WHERE event_id = ?", Integer.class, id)).isEqualTo(1);
        Map<String, Object> stored = jdbc.queryForMap(
            "SELECT risk_level::text AS risk, officer_note, verified_by FROM core_schema.landslide_events WHERE event_id = ?", id);
        assertThat(stored).containsEntry("risk", "high").containsEntry("officer_note", "second").containsEntry("verified_by", second);
    }

    @Test
    void verifyEventOnUnknownIdFindsNoRow() {
        assertThatThrownBy(() -> spatial.verifyEvent(UUID.randomUUID(), officer(), "verified", "high", null))
            .isInstanceOf(EmptyResultDataAccessException.class);
    }

    @Test
    void verifyEventRejectsAStatusOutsideTheEnum() {
        UUID id = event("pending", "low", 0.8, T0, square(106, 10, 0.001));
        UUID officer = officer();
        assertThatThrownBy(() -> spatial.verifyEvent(id, officer, "approved", "low", null)).isInstanceOf(DataAccessException.class);
    }

    // ---- GeoJSON exports ----

    @Test
    void verifiedEventsGeoJsonIsAFeatureCollectionOfVerifiedEventsOnly() throws Exception {
        UUID verified = event("verified", "extreme", 0.91, T0, square(106, 10, 0.01));
        event("pending", "extreme", 0.91, T0, square(106, 10.1, 0.01));
        event("rejected", "extreme", 0.91, T0, square(106, 10.2, 0.01));
        jdbc.update("UPDATE core_schema.landslide_events SET verified_at = ? WHERE event_id = ?", T0, verified);

        JsonNode collection = parse(spatial.getActiveVerifiedEventsGeoJson());

        assertThat(collection.get("type").asText()).isEqualTo("FeatureCollection");
        assertThat(featureIds(collection, mine)).containsExactly(verified.toString());
        JsonNode feature = null;
        for (JsonNode f : collection.get("features")) if (verified.toString().equals(f.get("id").asText())) feature = f;
        assertThat(feature.get("type").asText()).isEqualTo("Feature");
        assertThat(feature.get("geometry").get("type").asText()).isEqualTo("MultiPolygon");
        JsonNode props = feature.get("properties");
        assertThat(props.fieldNames()).toIterable().containsExactlyInAnyOrder(
            "event_id", "risk_level", "confidence", "area_m2", "slope", "verified_at", "scene_id");
        assertThat(props.get("event_id").asText()).isEqualTo(verified.toString());
        assertThat(props.get("risk_level").asText()).isEqualTo("extreme");
        assertThat(props.get("confidence").asDouble()).isEqualTo(0.91);
        assertThat(props.get("slope").asDouble()).isEqualTo(31.5);
        assertThat(props.get("scene_id").asText()).isEqualTo("SCENE-DBTEST");
        assertThat(props.get("area_m2").asDouble()).isBetween(1.15e6, 1.25e6);
        assertThat(OffsetDateTime.parse(props.get("verified_at").asText()).toInstant()).isEqualTo(T0.toInstant());
    }

    @Test
    void geoJsonExportsAreAnEmptyArrayNotNullWhenNothingIsVerified() throws Exception {
        jdbc.update("DELETE FROM core_schema.landslide_events WHERE status = 'verified'");
        event("pending", "high", 0.9, T0, square(106, 10, 0.001));

        for (String geojson : new String[]{spatial.getActiveVerifiedEventsGeoJson(), spatial.exportOfflineSyncGeoJson()}) {
            JsonNode collection = parse(geojson);
            assertThat(collection.get("type").asText()).isEqualTo("FeatureCollection");
            assertThat(collection.get("features").isArray()).isTrue();
            assertThat(collection.get("features")).isEmpty();
        }
    }

    @Test
    void offlineSyncExportKeepsOnlyIdGeometryAndRiskLevel() throws Exception {
        UUID verified = event("verified", "high", 0.6, T0, square(106, 10, 0.001));
        event("false_alarm", "high", 0.6, T0, square(106, 10.1, 0.001));
        event("pending", "high", 0.6, T0, square(106, 10.2, 0.001));

        JsonNode collection = parse(spatial.exportOfflineSyncGeoJson());

        assertThat(collection.get("type").asText()).isEqualTo("FeatureCollection");
        assertThat(featureIds(collection, mine)).containsExactly(verified.toString());
        for (JsonNode f : collection.get("features")) {
            if (!verified.toString().equals(f.get("id").asText())) continue;
            assertThat(f.get("geometry").get("type").asText()).isEqualTo("MultiPolygon");
            assertThat(f.get("properties").fieldNames()).toIterable().containsExactlyInAnyOrder("event_id", "risk_level");
            assertThat(f.get("properties").get("risk_level").asText()).isEqualTo("high");
        }
    }

    // ---- queryGeofence ----

    // Query point 0.01 degree of latitude (about 1106 m) south of the south edge of the first square.
    private static final double LON = 106.0005, LAT = 9.99;

    private UUID verifiedSquareNorthOfQueryPoint(double south) {
        return event("verified", "high", 0.9, T0, square(106, south, 0.001));
    }

    @Test
    void geofenceReturnsVerifiedEventsInsideTheRadiusNearestFirst() {
        UUID far = verifiedSquareNorthOfQueryPoint(10.030);     // about 4.4 km
        UUID near = verifiedSquareNorthOfQueryPoint(10.000);    // about 1.1 km
        UUID mid = verifiedSquareNorthOfQueryPoint(10.010);     // about 2.2 km
        UUID tooFar = verifiedSquareNorthOfQueryPoint(10.060);  // about 7.7 km

        List<Map<String, Object>> rows = spatial.queryGeofence(LON, LAT, 5000);

        assertThat(onlyMine(rows)).containsExactly(near, mid, far);
        List<Double> distances = rows.stream().filter(r -> mine.contains((UUID) r.get("event_id")))
            .map(r -> (Double) r.get("distance_meters")).toList();
        assertThat(distances).isSorted();
        assertThat(distances.get(0)).isBetween(1100.0, 1112.0);
        assertThat(distances.get(1)).isBetween(2205.0, 2220.0);
        assertThat(onlyMine(spatial.queryGeofence(LON, LAT, 3000))).containsExactly(near, mid).doesNotContain(far, tooFar);
        assertThat(rows.get(0).keySet()).containsExactlyInAnyOrder("event_id", "risk_level", "affected_area_m2", "distance_meters");
    }

    @Test
    void geofenceIgnoresEventsThatAreNotVerifiedEvenInsideTheRadius() {
        UUID verified = verifiedSquareNorthOfQueryPoint(10.000);
        event("pending", "high", 0.9, T0, square(106, 10.001, 0.001));
        event("rejected", "high", 0.9, T0, square(106, 10.002, 0.001));
        event("false_alarm", "high", 0.9, T0, square(106, 10.003, 0.001));

        assertThat(onlyMine(spatial.queryGeofence(LON, LAT, 5000))).containsExactly(verified);
    }

    @Test
    void pointInsidePolygonIsAtDistanceZeroEvenWithRadiusZero() {
        UUID id = event("verified", "high", 0.9, T0, square(106, 10, 0.01));

        for (double radius : new double[]{0, 1, 500}) {
            List<Map<String, Object>> rows = spatial.queryGeofence(106.005, 10.005, radius);
            assertThat(onlyMine(rows)).as("radius %s", radius).containsExactly(id);
            assertThat(rows.stream().filter(r -> id.equals(r.get("event_id"))).findFirst().orElseThrow().get("distance_meters")).isEqualTo(0.0);
        }
    }

    @Test
    void pointExactlyOnAPolygonCornerIsAtDistanceZero() {
        UUID id = event("verified", "high", 0.9, T0, square(106, 10, 0.01));

        // (106, 10) is the south-west corner of the square. (A mid-edge point is not used: geography edges are geodesics,
        // so a point on the planar edge is a few millimetres off the stored boundary.)
        List<Map<String, Object>> rows = spatial.queryGeofence(106.0, 10.0, 0);

        assertThat(onlyMine(rows)).containsExactly(id);
        assertThat(rows.stream().filter(r -> id.equals(r.get("event_id"))).findFirst().orElseThrow().get("distance_meters")).isEqualTo(0.0);
    }

    @Test
    void radiusJustAboveTheReportedDistanceIncludesTheEventAndJustBelowExcludesIt() {
        UUID id = verifiedSquareNorthOfQueryPoint(10.000);
        double distance = (Double) spatial.queryGeofence(LON, LAT, 5000).stream()
            .filter(r -> id.equals(r.get("event_id"))).findFirst().orElseThrow().get("distance_meters");

        // ST_Distance and ST_DWithin round differently on the spheroid, so probe 1 cm either side instead of the exact value.
        assertThat(onlyMine(spatial.queryGeofence(LON, LAT, distance + 0.01))).containsExactly(id);
        assertThat(onlyMine(spatial.queryGeofence(LON, LAT, distance - 0.01))).isEmpty();
    }

    @Test
    void geofenceTakesLongitudeFirstAndFindsNothingWhereNoEventLives() {
        UUID id = verifiedSquareNorthOfQueryPoint(10.000);

        assertThat(onlyMine(spatial.queryGeofence(106.0005, 10.0005, 100))).containsExactly(id);
        assertThat(spatial.queryGeofence(10.0005, 106.0005, 100)).as("swapped lat/lon").isEmpty();
        assertThat(spatial.queryGeofence(0, 0, 1000)).as("open ocean").isEmpty();
    }
}
