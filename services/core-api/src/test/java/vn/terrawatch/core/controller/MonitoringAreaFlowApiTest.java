package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** What the monitoring-area routes store and return, and how an area switched off drops out of alerting. */
class MonitoringAreaFlowApiTest extends FlowTestBase {
    private static final String BASE = "/api/v1/monitoring-areas";
    private static final Map<String, Object> SQUARE = Map.of("type", "Polygon", "coordinates", List.of(List.of(
        List.of(105.0, 21.0), List.of(105.1, 21.0), List.of(105.1, 21.1), List.of(105.0, 21.1), List.of(105.0, 21.0))));
    private static final Map<String, Object> OTHER_SQUARE = Map.of("type", "Polygon", "coordinates", List.of(List.of(
        List.of(106.0, 22.0), List.of(106.2, 22.0), List.of(106.2, 22.2), List.of(106.0, 22.2), List.of(106.0, 22.0))));
    private static final Map<String, Object> MULTI = Map.of("type", "MultiPolygon", "coordinates", List.of(
        List.of(List.of(List.of(107.0, 20.0), List.of(107.1, 20.0), List.of(107.1, 20.1), List.of(107.0, 20.1), List.of(107.0, 20.0))),
        List.of(List.of(List.of(108.0, 20.0), List.of(108.1, 20.0), List.of(108.1, 20.1), List.of(108.0, 20.1), List.of(108.0, 20.0)))));

    private String geometryType(int areaId) {
        return jdbc.queryForObject("SELECT ST_GeometryType(geom) || '/' || ST_SRID(geom) || '/' || ST_NumGeometries(geom) FROM gis_schema.monitoring_areas WHERE area_id = ?",
            String.class, areaId);
    }

    @Test
    void polygonIsStoredAsAMultiPolygonInWgs84AndTheNewRowIsReturnedActive() throws Exception {
        Acct admin = account("admin");

        JsonNode created = read(call(HttpMethod.POST, BASE, admin, Map.of("name", "Vung moi " + UUID.randomUUID(), "description", "mo ta", "geojson", SQUARE))
            .andExpect(status().isOk()));

        assertThat(created.get("area_id").asInt()).isPositive();
        assertThat(created.get("description").asText()).isEqualTo("mo ta");
        assertThat(created.get("is_active").asBoolean()).isTrue();
        assertThat(created.get("created_at").asText()).isNotBlank();
        assertThat(created.has("geometry_geojson")).isFalse();
        assertThat(geometryType(created.get("area_id").asInt())).isEqualTo("ST_MultiPolygon/4326/1");
    }

    @Test
    void multiPolygonKeepsEveryPartAndDescriptionMayBeOmitted() throws Exception {
        Acct admin = account("admin");

        JsonNode created = read(call(HttpMethod.POST, BASE, admin, Map.of("name", "Vung hai manh " + UUID.randomUUID(), "geojson", MULTI))
            .andExpect(status().isOk()));

        assertThat(geometryType(created.get("area_id").asInt())).isEqualTo("ST_MultiPolygon/4326/2");
        assertThat(created.get("description").isNull()).isTrue();
    }

    @Test
    void publicListIsOrderedByIdKeepsInactiveAreasAndReturnsGeometryAsGeoJson() throws Exception {
        int first = seedArea("flow-list-a", true);
        int second = seedArea("flow-list-b", false);

        JsonNode rows = read(call(HttpMethod.GET, BASE, null, null).andExpect(status().isOk()));

        List<Integer> ids = new ArrayList<>();
        rows.forEach(r -> ids.add(r.get("area_id").asInt()));
        assertThat(ids).isSorted().containsSubsequence(first, second);
        JsonNode inactive = null;
        for (JsonNode r : rows) if (r.get("area_id").asInt() == second) inactive = r;
        assertThat(inactive.get("is_active").asBoolean()).isFalse();
        assertThat(inactive.get("name").asText()).startsWith("flow-list-b");
        assertThat(inactive.get("description").asText()).isEqualTo("seed");
        JsonNode geometry = json.readTree(inactive.get("geometry_geojson").asText());
        assertThat(geometry.get("type").asText()).isEqualTo("MultiPolygon");
        assertThat(geometry.get("coordinates").get(0).get(0)).hasSize(5);
    }

    @Test
    void newAreaAppearsInThePublicListAndIsSubscribableRightAway() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        String name = "Vung dang ky " + UUID.randomUUID();
        int id = read(call(HttpMethod.POST, BASE, admin, Map.of("name", name, "geojson", SQUARE))).get("area_id").asInt();

        JsonNode rows = read(call(HttpMethod.GET, BASE, null, null));
        boolean listed = false;
        for (JsonNode r : rows) listed |= r.get("area_id").asInt() == id && r.get("name").asText().equals(name);
        assertThat(listed).isTrue();
        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", citizen, Map.of("areaId", id, "alertChannels", List.of("PUSH")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.areaName").value(name));
    }

    @Test
    void updateWithOnlyANameLeavesDescriptionActiveFlagAndBoundaryAlone() throws Exception {
        Acct admin = account("admin");
        int id = read(call(HttpMethod.POST, BASE, admin, Map.of("name", "Vung cu " + UUID.randomUUID(), "description", "giu nguyen", "geojson", SQUARE)))
            .get("area_id").asInt();
        String before = jdbc.queryForObject("SELECT ST_AsText(geom) FROM gis_schema.monitoring_areas WHERE area_id = ?", String.class, id);
        String renamed = "Vung doi ten " + UUID.randomUUID();

        call(HttpMethod.PUT, BASE + "/" + id, admin, Map.of("name", renamed))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.area_id").value(id))
            .andExpect(jsonPath("$.name").value(renamed))
            .andExpect(jsonPath("$.description").value("giu nguyen"))
            .andExpect(jsonPath("$.is_active").value(true));

        assertThat(jdbc.queryForObject("SELECT ST_AsText(geom) FROM gis_schema.monitoring_areas WHERE area_id = ?", String.class, id)).isEqualTo(before);
    }

    @Test
    void updateWithABoundaryReplacesTheGeometryAndReturnsItAsGeoJson() throws Exception {
        Acct admin = account("admin");
        int id = seedArea();

        JsonNode updated = read(call(HttpMethod.PUT, BASE + "/" + id, admin, Map.of("geojson", OTHER_SQUARE)).andExpect(status().isOk()));

        JsonNode geometry = json.readTree(updated.get("geometry_geojson").asText());
        assertThat(geometry.get("type").asText()).isEqualTo("MultiPolygon");
        assertThat(geometry.get("coordinates").get(0).get(0).get(0).get(0).asDouble()).isEqualTo(106.0);
        assertThat(geometryType(id)).isEqualTo("ST_MultiPolygon/4326/1");
        assertThat(jdbc.queryForObject("SELECT ST_XMin(geom) FROM gis_schema.monitoring_areas WHERE area_id = ?", Double.class, id)).isEqualTo(106.0);
    }

    @Test
    void switchingAnAreaOffStopsNewSubscriptionsAndPreviewsButKeepsTheRow() throws Exception {
        Acct admin = account("admin");
        Acct citizen = account("citizen");
        int id = seedArea();

        call(HttpMethod.PUT, BASE + "/" + id, admin, Map.of("isActive", false))
            .andExpect(status().isOk()).andExpect(jsonPath("$.is_active").value(false));

        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", citizen, Map.of("areaId", id, "alertChannels", List.of("PUSH"))).andExpect(status().isNotFound());
        call(HttpMethod.GET, "/api/v1/notifications/broadcast/preview?areaId=" + id, admin, null).andExpect(status().isNotFound());
        assertThat(count("SELECT count(*) FROM gis_schema.monitoring_areas WHERE area_id = ?", id)).isEqualTo(1);

        call(HttpMethod.PUT, BASE + "/" + id, admin, Map.of("isActive", true)).andExpect(status().isOk());
        em.clear(); // the update is plain SQL; drop the JPA copy of the area that the refused subscribe loaded
        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", citizen, Map.of("areaId", id, "alertChannels", List.of("PUSH"))).andExpect(status().isOk());
    }

    @Test
    void renamingToANameAnotherAreaHasIsAConflictAndKeepsTheOldName() throws Exception {
        Acct admin = account("admin");
        String taken = "Vung da co " + UUID.randomUUID();
        call(HttpMethod.POST, BASE, admin, Map.of("name", taken, "geojson", SQUARE)).andExpect(status().isOk());
        int other = read(call(HttpMethod.POST, BASE, admin, Map.of("name", "Vung khac " + UUID.randomUUID(), "geojson", OTHER_SQUARE))).get("area_id").asInt();

        call(HttpMethod.PUT, BASE + "/" + other, admin, Map.of("name", taken))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("A monitoring area with this name already exists"));
    }
}
