package vn.terrawatch.core.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/** Monitoring-area and community-report queries of {@link SpatialRepository}; each test is rolled back. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SpatialAreaAndReportRepositoryDbTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String POLYGON = "{\"type\":\"Polygon\",\"coordinates\":[[[106,10],[106.01,10],[106.01,10.01],[106,10.01],[106,10]]]}";
    private static final String OTHER_POLYGON = "{\"type\":\"Polygon\",\"coordinates\":[[[107,11],[107.02,11],[107.02,11.02],[107,11.02],[107,11]]]}";
    private static final String BOWTIE = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[1,1],[1,0],[0,1],[0,0]]]}";

    private SpatialRepository spatial;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void repository() {
        spatial = new SpatialRepository(jdbc);
    }

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    private String geometryOf(Object areaId) {
        return jdbc.queryForObject("SELECT ST_AsText(geom) FROM gis_schema.monitoring_areas WHERE area_id = ?", String.class, areaId);
    }

    // ---- isValidGeometry ----

    @Test
    void isValidGeometryAcceptsASimpleRingAndRejectsASelfIntersectingBowTie() {
        assertThat(spatial.isValidGeometry(POLYGON)).isTrue();
        assertThat(spatial.isValidGeometry(BOWTIE)).isFalse();
    }

    @Test
    void isValidGeometryTreatsAnUnclosedRingAsInvalid() {
        String unclosed = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[1,0],[1,1],[0,1]]]}";
        assertThat(spatial.isValidGeometry(unclosed)).isFalse();
    }

    // ---- createMonitoringArea ----

    @Test
    void createMonitoringAreaWrapsAPolygonAsMultiPolygonWithSrid4326AndDefaultsToActive() {
        String name = unique("area");

        Map<String, Object> created = spatial.createMonitoringArea(name, "desc", POLYGON);

        assertThat(created.keySet()).containsExactlyInAnyOrder("area_id", "name", "description", "is_active", "created_at");
        assertThat(created).containsEntry("name", name).containsEntry("description", "desc").containsEntry("is_active", true);
        assertThat(created.get("created_at")).isNotNull();
        Map<String, Object> stored = jdbc.queryForMap(
            "SELECT GeometryType(geom) AS type, ST_SRID(geom) AS srid, ST_Area(geom) AS area FROM gis_schema.monitoring_areas WHERE area_id = ?",
            created.get("area_id"));
        assertThat(stored).containsEntry("type", "MULTIPOLYGON").containsEntry("srid", 4326);
        assertThat((Double) stored.get("area")).isCloseTo(0.0001, within(1e-12));
    }

    @Test
    void createMonitoringAreaWithNullDescriptionStoresNull() {
        Map<String, Object> created = spatial.createMonitoringArea(unique("area"), null, POLYGON);
        assertThat(created.get("description")).isNull();
    }

    @Test
    void createMonitoringAreaRejectsADuplicateName() {
        String name = unique("area");
        spatial.createMonitoringArea(name, "first", POLYGON);

        assertThatThrownBy(() -> spatial.createMonitoringArea(name, "second", OTHER_POLYGON)).isInstanceOf(DuplicateKeyException.class);
    }

    // ---- listMonitoringAreas ----

    @Test
    void listMonitoringAreasIsOrderedByAreaIdAndReturnsGeoJsonGeometry() throws Exception {
        Map<String, Object> a = spatial.createMonitoringArea(unique("a"), "first", POLYGON);
        Map<String, Object> b = spatial.createMonitoringArea(unique("b"), "second", OTHER_POLYGON);
        jdbc.update("UPDATE gis_schema.monitoring_areas SET is_active = false WHERE area_id = ?", b.get("area_id"));

        List<Map<String, Object>> rows = spatial.listMonitoringAreas();

        List<Integer> ids = rows.stream().map(r -> (Integer) r.get("area_id")).toList();
        assertThat(ids).isSorted();
        assertThat(ids).contains((Integer) a.get("area_id"), (Integer) b.get("area_id"));
        assertThat(ids.indexOf(a.get("area_id"))).isLessThan(ids.indexOf(b.get("area_id")));
        Map<String, Object> rowA = rows.stream().filter(r -> r.get("area_id").equals(a.get("area_id"))).findFirst().orElseThrow();
        Map<String, Object> rowB = rows.stream().filter(r -> r.get("area_id").equals(b.get("area_id"))).findFirst().orElseThrow();
        assertThat(rowA.keySet()).containsExactlyInAnyOrder("area_id", "name", "description", "is_active", "geometry_geojson", "created_at");
        assertThat(rowA).containsEntry("is_active", true);
        assertThat(rowB).as("the listing includes inactive areas").containsEntry("is_active", false);
        JsonNode geometry = JSON.readTree((String) rowA.get("geometry_geojson"));
        assertThat(geometry.get("type").asText()).isEqualTo("MultiPolygon");
        assertThat(geometry.get("coordinates").get(0).get(0).get(0).get(0).asDouble()).isEqualTo(106.0);
        assertThat(geometry.get("coordinates").get(0).get(0).get(2).get(1).asDouble()).isEqualTo(10.01);
    }

    // ---- updateMonitoringArea ----

    @Test
    void updateMonitoringAreaWithNullFieldsAndNoGeometryChangesNothing() {
        Map<String, Object> created = spatial.createMonitoringArea(unique("area"), "keep me", POLYGON);
        int id = (Integer) created.get("area_id");

        Map<String, Object> updated = spatial.updateMonitoringArea(id, null, null, null, null);

        assertThat(updated).containsEntry("name", created.get("name")).containsEntry("description", "keep me").containsEntry("is_active", true);
        assertThat(updated.keySet()).containsExactlyInAnyOrder("area_id", "name", "description", "is_active", "created_at", "geometry_geojson");
        assertThat(geometryOf(id)).isEqualTo(jdbc.queryForObject(
            "SELECT ST_AsText(ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)))", String.class, POLYGON));
    }

    @Test
    void updateMonitoringAreaTreatsABlankGeometryAsNoGeometryChange() {
        int id = (Integer) spatial.createMonitoringArea(unique("area"), null, POLYGON).get("area_id");
        String before = geometryOf(id);

        spatial.updateMonitoringArea(id, "renamed-" + id, null, null, "   ");

        assertThat(geometryOf(id)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT name FROM gis_schema.monitoring_areas WHERE area_id = ?", String.class, id)).isEqualTo("renamed-" + id);
    }

    @Test
    void updateMonitoringAreaCanDeactivateAndReplaceTheGeometryKeepingMultiPolygonAndSrid() throws Exception {
        int id = (Integer) spatial.createMonitoringArea(unique("area"), "d", POLYGON).get("area_id");

        Map<String, Object> updated = spatial.updateMonitoringArea(id, null, "new d", false, OTHER_POLYGON);

        assertThat(updated).containsEntry("is_active", false).containsEntry("description", "new d");
        assertThat(JSON.readTree((String) updated.get("geometry_geojson")).get("type").asText()).isEqualTo("MultiPolygon");
        assertThat(JSON.readTree((String) updated.get("geometry_geojson")).get("coordinates").get(0).get(0).get(0).get(0).asDouble()).isEqualTo(107.0);
        assertThat(jdbc.queryForObject("SELECT ST_SRID(geom) FROM gis_schema.monitoring_areas WHERE area_id = ?", Integer.class, id)).isEqualTo(4326);
    }

    @Test
    void updateMonitoringAreaOnUnknownIdFindsNoRowOnBothBranches() {
        assertThatThrownBy(() -> spatial.updateMonitoringArea(-1, "x", null, null, null)).isInstanceOf(EmptyResultDataAccessException.class);
        assertThatThrownBy(() -> spatial.updateMonitoringArea(-1, "x", null, null, POLYGON)).isInstanceOf(EmptyResultDataAccessException.class);
    }

    // ---- community reports ----

    private int report(UUID userId, double lon, double lat, OffsetDateTime time, String status, String description) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.community_reports (user_id, location, report_time, status, description, image_url)
            VALUES (?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, CAST(? AS core_schema.report_status), ?, 'http://img/x.jpg')
            RETURNING report_id
            """, Integer.class, userId, lon, lat, time, status, description);
    }

    private UUID user(String fullName, String phone) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO core_schema.users (user_id, full_name, email, password_hash, phone_number) VALUES (?, ?, ?, 'x', ?)",
            id, fullName, id + "@spatial-db.example", phone);
        return id;
    }

    @Test
    void listCommunityReportsIsNewestFirstWithLonLatAndLeftJoinedSubmitter() {
        OffsetDateTime t = OffsetDateTime.parse("2031-01-01T00:00:00Z"); // later than any seed row
        UUID reporter = user("Nguyen Reporter", "0911111111");
        int older = report(reporter, 105.5, 21.25, t, "submitted", "older");
        int newer = report(null, 104.0, 20.0, t.plusHours(1), "processed", "newer, anonymous");

        List<Map<String, Object>> rows = spatial.listCommunityReports();

        assertThat(rows.get(0).get("report_id")).isEqualTo(newer);
        assertThat(rows.get(1).get("report_id")).isEqualTo(older);
        Map<String, Object> newerRow = rows.get(0);
        assertThat(newerRow.keySet()).containsExactlyInAnyOrder("report_id", "report_time", "image_url", "description", "status",
            "observed_at", "longitude", "latitude", "submitter_name", "submitter_phone");
        assertThat(newerRow.get("submitter_name")).as("report without a user survives the LEFT JOIN").isNull();
        assertThat(newerRow.get("submitter_phone")).isNull();
        assertThat(newerRow).containsEntry("longitude", 104.0).containsEntry("latitude", 20.0);
        assertThat(String.valueOf(newerRow.get("status"))).isEqualTo("processed");
        assertThat(rows.get(1)).containsEntry("submitter_name", "Nguyen Reporter").containsEntry("submitter_phone", "0911111111")
            .containsEntry("longitude", 105.5).containsEntry("latitude", 21.25);
    }

    // ---- updateReportStatus ----

    @Test
    void updateReportStatusChangesOneRowAndReportsZeroForAnUnknownId() {
        int id = report(null, 105, 21, OffsetDateTime.now(), "submitted", "r");
        int untouched = report(null, 105, 21, OffsetDateTime.now(), "submitted", "other");

        assertThat(spatial.updateReportStatus(id, "archived")).isEqualTo(1);
        assertThat(spatial.updateReportStatus(-1, "archived")).isZero();

        assertThat(jdbc.queryForObject("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", String.class, id)).isEqualTo("archived");
        assertThat(jdbc.queryForObject("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", String.class, untouched)).isEqualTo("submitted");
    }

    @Test
    void updateReportStatusRejectsAValueOutsideTheEnum() {
        int id = report(null, 105, 21, OffsetDateTime.now(), "submitted", "r");
        assertThatThrownBy(() -> spatial.updateReportStatus(id, "deleted")).isInstanceOf(DataAccessException.class);
    }
}
