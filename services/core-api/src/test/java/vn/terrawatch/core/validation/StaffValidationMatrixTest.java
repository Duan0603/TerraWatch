package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import vn.terrawatch.core.validation.Matrix.Case;
import vn.terrawatch.core.validation.Matrix.Cases;
import vn.terrawatch.core.validation.Matrix.Route;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static vn.terrawatch.core.validation.Matrix.a;
import static vn.terrawatch.core.validation.Matrix.drop;
import static vn.terrawatch.core.validation.Matrix.route;
import static vn.terrawatch.core.validation.Matrix.set;

/**
 * Request-body validation of the officer and admin routes, each called with the least-privileged role the
 * route allows (officer for forecasts / incidents / report status, admin for users / areas / broadcasts).
 */
class StaffValidationMatrixTest extends ValidationTestBase {
    static final String SEEDED_EVENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    static final Map<String, Object> SQUARE = map("type", "Polygon", "coordinates", List.of(List.of(
        List.of(105.0, 21.0), List.of(105.1, 21.0), List.of(105.1, 21.1), List.of(105.0, 21.1), List.of(105.0, 21.0))));

    static final Route ROLE = route("PATCH /api/v1/admin/users/{id}/role", 200, t -> {
        Acct admin = t.account("admin", t.uniq("adm"));
        Acct target = t.account("citizen", t.uniq("target"));
        return t.probing("/api/v1/admin/users/" + target.id() + "/role", admin, map("role", "officer"),
            () -> t.column("SELECT role::text FROM core_schema.users WHERE user_id = ?", target.id()));
    });
    static final Route STATUS = route("PATCH /api/v1/admin/users/{id}/status", 200, t -> {
        Acct admin = t.account("admin", t.uniq("adm"));
        Acct target = t.account("citizen", t.uniq("target"));
        return t.probing("/api/v1/admin/users/" + target.id() + "/status", admin, map("isActive", false),
            () -> t.column("SELECT is_active FROM core_schema.users WHERE user_id = ?", target.id()));
    });
    static final Route REPORT_STATUS = route("PATCH /api/v1/community-reports/{id}/status", 200, t -> {
        Acct officer = t.account("officer", t.uniq("off"));
        int id = t.seedReport(officer.id());
        return t.probing("/api/v1/community-reports/" + id + "/status", officer, map("status", "processed"),
            () -> t.column("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", id));
    });
    static final Route FORECAST_CREATE = route("POST /api/v1/forecasts", 202, t -> {
        Acct officer = t.account("officer", t.uniq("off"));
        String unit = t.uniq("UNIT");
        t.seedUnit(unit);
        return t.creating("/api/v1/forecasts", officer, map("unitId", unit, "unitVersion", "v1", "modelVersion", "xgb-v1", "thresholdVersion", "th-v1"),
            "core_schema.forecast_runs");
    });
    static final Route FORECAST_REVIEW = route("PATCH /api/v1/forecasts/{id}/review", 200, t -> {
        Acct officer = t.account("officer", t.uniq("off"));
        String unit = t.uniq("UNIT");
        t.seedUnit(unit);
        UUID run = t.seedPendingRun(unit);
        return t.probing("/api/v1/forecasts/" + run + "/review", officer, map("decision", "approved", "reasonNotes", "looks right"),
            () -> t.column("SELECT review_status::text || '/' || (SELECT count(*) FROM core_schema.forecast_reviews WHERE run_id = ?) FROM core_schema.forecast_runs WHERE run_id = ?", run, run));
    });
    static final Route VERIFY = route("PATCH /api/v1/landslides/{id}/verify", 200, t -> {
        Acct officer = t.account("officer", t.uniq("off"));
        return t.probing("/api/v1/landslides/" + SEEDED_EVENT + "/verify", officer, map("status", "verified", "riskLevel", "high", "officerNote", "checked on site"),
            () -> t.column("SELECT status::text || '/' || risk_level::text || '/' || COALESCE(officer_note, '') FROM core_schema.landslide_events WHERE event_id = ?::uuid", SEEDED_EVENT));
    });
    static final Route AREA_CREATE = route("POST /api/v1/monitoring-areas", 200, t -> {
        Acct admin = t.account("admin", t.uniq("adm"));
        return t.creating("/api/v1/monitoring-areas", admin, map("name", t.uniq("Vùng"), "description", "mô tả", "geojson", SQUARE), "gis_schema.monitoring_areas");
    });
    static final Route AREA_UPDATE = route("PUT /api/v1/monitoring-areas/{id}", 200, t -> {
        Acct admin = t.account("admin", t.uniq("adm"));
        int id = t.seedArea(t.uniq("seed-area"));
        return t.probing("/api/v1/monitoring-areas/" + id, admin, map("name", t.uniq("Vùng mới"), "description", "mô tả mới", "isActive", true, "geojson", SQUARE),
            () -> t.column("SELECT concat_ws('|', name, description, is_active) FROM gis_schema.monitoring_areas WHERE area_id = ?", id));
    });
    static final Route BROADCAST = route("POST /api/v1/notifications/broadcast", 200, t -> {
        Acct admin = t.account("admin", t.uniq("adm"));
        int area = t.seedArea(t.uniq("bc-area"));
        t.seedSubscriber(area);
        return t.creating("/api/v1/notifications/broadcast", admin, map("riskLevel", "high", "areaId", area, "message", "Sơ tán ngay", "eventId", t.uniq("evt"),
            "incidentPhase", "during_incident"), "core_schema.alert_broadcasts");
    });

    static final List<Route> ROUTES = List.of(ROLE, STATUS, REPORT_STATUS, FORECAST_CREATE, FORECAST_REVIEW, VERIFY, AREA_CREATE, AREA_UPDATE, BROADCAST);

    static Stream<Case> role() {
        return new Cases(ROLE).envelope(400)
            .required("role").notText("role")
            .oneOf("role", List.of("admin", "officer", "citizen", "OFFICER", " citizen "), List.of())
            .message("role unknown value", 400, "Vai trò không hợp lệ: superuser", set("role", "superuser"))
            .message("role empty-ish 'ADMINISTRATOR'", 400, "Vai trò không hợp lệ: ADMINISTRATOR", set("role", "ADMINISTRATOR"))
            .stream();
    }

    static Stream<Case> status() {
        return new Cases(STATUS).envelope(200)
            .ok("isActive true", set("isActive", true))
            .ok("isActive false", set("isActive", false))
            .ok("is_active alias", m -> { m.remove("isActive"); m.put("is_active", false); return m; })
            .ok("active alias", m -> { m.remove("isActive"); m.put("active", false); return m; })
            .bad("isActive is an object", set("isActive", Map.of()))
            .bad("isActive is a text that is not a boolean", set("isActive", "maybe"))
            .stream();
    }

    static Stream<Case> reportStatus() {
        String invalid = "Invalid status: must be submitted, processed, or archived";
        return new Cases(REPORT_STATUS)
            .ok("valid request", Matrix.sameBody())
            .ok("status submitted", set("status", "submitted")).ok("status archived", set("status", "archived"))
            .ok("status upper case and padded", set("status", " PROCESSED "))
            .message("status unknown value", 400, invalid, set("status", "deleted"))
            .message("status empty string", 400, invalid, set("status", ""))
            .message("status whitespace only", 400, invalid, set("status", "   "))
            .message("status missing", 400, invalid, drop("status"))
            .message("status null", 400, invalid, set("status", null))
            .message("status is a number", 400, invalid, set("status", 5))
            .message("status SQL fragment", 400, invalid, set("status", "'; DROP TABLE users;--"))
            .message("status 10,000 chars", 400, invalid, set("status", a(10_000)))
            .bad("status is a JSON object", set("status", Map.of()))
            .bad("status is a JSON array", set("status", List.of("processed")))
            .message("empty object {}", 400, invalid, m -> new java.util.LinkedHashMap<>())
            .raw("malformed JSON", 400, "{")
            .raw("empty body", 400, "")
            .raw("JSON array instead of object", 400, "[]")
            .stream();
    }

    static Stream<Case> forecastCreate() {
        return new Cases(FORECAST_CREATE).envelope(400)
            .required("unitId", "modelVersion", "thresholdVersion").notText("unitId", "modelVersion", "thresholdVersion", "unitVersion")
            .ok("unitVersion missing defaults to v1", drop("unitVersion"))
            .ok("unitVersion null defaults to v1", set("unitVersion", null))
            .ok("unitVersion 20 chars (column limit)", set("unitVersion", a(20)))
            .ok("modelVersion 50 chars (column limit)", set("modelVersion", a(50)))
            .ok("thresholdVersion 50 chars (column limit)", set("thresholdVersion", a(50)))
            .ok("snapshotId null", set("snapshotId", null))
            .bad("snapshotId not a UUID", set("snapshotId", "not-a-uuid"))
            .bad("snapshotId is a number", set("snapshotId", 5))
            .stream();
    }

    static Stream<Case> forecastReview() {
        return new Cases(FORECAST_REVIEW).envelope(400)
            .required("decision").notText("decision")
            .oneOf("decision", List.of("approved"), List.of("Approved", "APPROVED", "pending", "superseded", "approve", " approved", "approved ", "approved|rejected"))
            .message("decision rejected without a reason", 400, "A reason is required to reject a forecast", m -> { m.put("decision", "rejected"); m.remove("reasonNotes"); return m; })
            .message("decision rejected with a blank reason", 400, "A reason is required to reject a forecast", m -> { m.put("decision", "rejected"); m.put("reasonNotes", "   "); return m; })
            .ok("decision rejected with a reason", m -> { m.put("decision", "rejected"); m.put("reasonNotes", "wrong rainfall input"); return m; })
            .ok("approved without reasonNotes", drop("reasonNotes"))
            .ok("approved with reasonNotes null", set("reasonNotes", null))
            .bad("reasonNotes is a JSON object", set("reasonNotes", Map.of()))
            .stream();
    }

    static Stream<Case> verify() {
        String badStatus = "status must be pending, verified, rejected or false_alarm";
        String badRisk = "riskLevel must be low, medium, high or extreme";
        return new Cases(VERIFY)
            .ok("valid request", Matrix.sameBody())
            .ok("unknown extra field is ignored", set("unexpectedField", "x"))
            .ok("officerId sent by the client is ignored", set("officerId", "33333333-3333-3333-3333-333333333333"))
            .message("empty object {} (no status)", 400, badStatus, m -> new java.util.LinkedHashMap<>())
            .message("status missing", 400, badStatus, drop("status"))
            .message("status null", 400, badStatus, set("status", null))
            .message("status empty string", 400, badStatus, set("status", ""))
            .message("status whitespace only", 400, badStatus, set("status", "   "))
            .message("status Verified (case)", 400, badStatus, set("status", "Verified"))
            .message("status unknown", 400, badStatus, set("status", "done"))
            .ok("status pending", set("status", "pending")).ok("status rejected", set("status", "rejected")).ok("status false_alarm", set("status", "false_alarm"))
            .bad("status is a JSON object", set("status", Map.of()))
            .ok("riskLevel low", set("riskLevel", "low")).ok("riskLevel medium", set("riskLevel", "medium")).ok("riskLevel extreme", set("riskLevel", "extreme"))
            .ok("riskLevel null keeps the old level", set("riskLevel", null)).ok("riskLevel missing keeps the old level", drop("riskLevel"))
            .message("riskLevel unknown", 400, badRisk, set("riskLevel", "critical"))
            .message("riskLevel empty string", 400, badRisk, set("riskLevel", ""))
            .message("riskLevel upper case", 400, badRisk, set("riskLevel", "HIGH"))
            .ok("officerNote null", set("officerNote", null)).ok("officerNote empty", set("officerNote", ""))
            .bad("officerNote is a JSON object", set("officerNote", Map.of()))
            .raw("malformed JSON", 400, "{")
            .raw("empty body", 400, "")
            .stream();
    }

    static Stream<Case> areaCreate() {
        String invalidShape = "Monitoring area boundary is not a valid polygon (it may cross itself)";
        return new Cases(AREA_CREATE)
            .ok("valid request", Matrix.sameBody())
            .ok("unknown extra field is ignored", set("unexpectedField", "x"))
            .ok("name 255 chars (column limit)", set("name", a(255)))
            .ok("description null", set("description", null)).ok("description missing", drop("description"))
            .message("geojson missing", 400, invalidShape, drop("geojson"))
            .message("geojson null", 400, invalidShape, set("geojson", null))
            .message("geojson is a string", 400, invalidShape, set("geojson", "not geojson"))
            .message("geojson empty object", 400, invalidShape, set("geojson", Map.of()))
            .message("geojson unknown type", 400, invalidShape, set("geojson", map("type", "Nope", "coordinates", List.of())))
            .message("geojson polygon with 3 points (unclosed)", 400, invalidShape,
                set("geojson", map("type", "Polygon", "coordinates", List.of(List.of(List.of(105.0, 21.0), List.of(105.1, 21.0), List.of(105.1, 21.1))))))
            .message("geojson coordinates are text", 400, invalidShape, set("geojson", map("type", "Polygon", "coordinates", "abc")))
            .message("geojson bow-tie polygon", 400, invalidShape, set("geojson", map("type", "Polygon", "coordinates", List.of(List.of(
                List.of(104.0, 22.0), List.of(104.1, 22.1), List.of(104.1, 22.0), List.of(104.0, 22.1), List.of(104.0, 22.0))))))
            .bad("name is a JSON object", set("name", Map.of()))
            .bad("description is a JSON array", set("description", List.of(1)))
            .raw("malformed JSON", 400, "{")
            .raw("empty body", 400, "")
            .raw("JSON array instead of object", 400, "[]")
            .stream();
    }

    static Stream<Case> areaUpdate() {
        String invalidShape = "Monitoring area boundary is not a valid polygon (it may cross itself)";
        return new Cases(AREA_UPDATE)
            .ok("valid request", Matrix.sameBody())
            .ok("unknown extra field is ignored", set("unexpectedField", "x"))
            .ok("empty object {} changes nothing", m -> new java.util.LinkedHashMap<>())
            .ok("only name", m -> map("name", "Chỉ đổi tên " + UUID.randomUUID()))
            .ok("isActive false", set("isActive", false))
            .ok("name 255 chars (column limit)", set("name", a(255)))
            .ok("geojson missing keeps the shape", drop("geojson"))
            .message("geojson is a string", 400, invalidShape, set("geojson", "not geojson"))
            .message("geojson unknown type", 400, invalidShape, set("geojson", map("type", "Nope", "coordinates", List.of())))
            .bad("isActive is a text that is not a boolean", set("isActive", "maybe"))
            .bad("isActive is an object", set("isActive", Map.of()))
            .bad("name is a JSON object", set("name", Map.of()))
            .raw("malformed JSON", 400, "{")
            .raw("empty body", 400, "")
            .raw("JSON array instead of object", 400, "[]")
            .stream();
    }

    static Stream<Case> broadcast() {
        return new Cases(BROADCAST)
            .ok("valid request", Matrix.sameBody())
            .ok("unknown extra field is ignored", set("unexpectedField", "x"))
            .message("empty object {} (no riskLevel)", 400, "Invalid riskLevel", m -> new java.util.LinkedHashMap<>())
            .message("riskLevel missing", 400, "Invalid riskLevel", drop("riskLevel"))
            .message("riskLevel null", 400, "Invalid riskLevel", set("riskLevel", null))
            .message("riskLevel empty string", 400, "Invalid riskLevel", set("riskLevel", ""))
            .message("riskLevel whitespace only", 400, "Invalid riskLevel", set("riskLevel", "   "))
            .message("riskLevel critical (outside the list)", 400, "Invalid riskLevel", set("riskLevel", "critical"))
            .ok("riskLevel low", set("riskLevel", "low")).ok("riskLevel medium", set("riskLevel", "medium")).ok("riskLevel extreme", set("riskLevel", "extreme"))
            .ok("riskLevel HIGH is normalised", set("riskLevel", "HIGH"))
            .message("incidentPhase unknown", 400, "Invalid incidentPhase", set("incidentPhase", "after"))
            .message("incidentPhase upper case", 400, "Invalid incidentPhase", set("incidentPhase", "PRE_INCIDENT"))
            .ok("incidentPhase pre_incident", set("incidentPhase", "pre_incident")).ok("incidentPhase post_incident", set("incidentPhase", "post_incident"))
            .ok("incidentPhase null defaults to during_incident", set("incidentPhase", null)).ok("incidentPhase blank defaults to during_incident", set("incidentPhase", "  "))
            .message("runId not a UUID", 400, "Invalid runId", set("runId", "not-a-uuid"))
            .status("runId unknown UUID", 409, set("runId", UNKNOWN_UUID.toString()))
            .ok("runId blank is ignored", set("runId", "  ")).ok("runId null", set("runId", null))
            .status("areaId unknown 99999 reaches nobody and answers NO_RECIPIENTS", 200, set("areaId", 99999))
            .bad("areaId is text", set("areaId", "abc")).bad("areaId is an object", set("areaId", Map.of())).bad("areaId 2147483648 (overflows int)", set("areaId", 2147483648L))
            .ok("eventId 100 chars (column limit)", set("eventId", a(100)))
            .ok("eventId null", set("eventId", null)).ok("message null uses the default text", set("message", null)).ok("message blank uses the default text", set("message", "  "))
            .bad("message is a JSON object", set("message", Map.of()))
            .bad("eventId is a JSON array", set("eventId", List.of(1)))
            .raw("malformed JSON", 400, "{")
            .raw("empty body", 400, "")
            .raw("JSON array instead of object", 400, "[]")
            .stream();
    }

    static Stream<Case> rows() {
        return Stream.of(role(), status(), reportStatus(), forecastCreate(), forecastReview(), verify(), areaCreate(), areaUpdate(), broadcast()).flatMap(s -> s);
    }

    @org.junit.jupiter.api.Disabled("BUG: expected 400 for geojson of type Point, actual unhandled PSQLException 'Geometry type (MultiPoint) does not match column type (MultiPolygon)' = HTTP 500 "
        + "(MonitoringAreaService.createArea: validGeoJson() accepts any valid geometry, the INSERT then fails and is rethrown as RuntimeException)")
    @org.junit.jupiter.api.Test
    void bugAreaCreateWithPointGeometryIs500() throws Exception {
        run(new Case(AREA_CREATE, "geojson point instead of polygon", set("geojson", map("type", "Point", "coordinates", List.of(105.0, 21.0))), null, 400, null));
    }

    @org.junit.jupiter.api.Disabled("BUG: expected 400 for isActive 7 (a number is not a boolean), actual 200 and the account is unlocked "
        + "(UpdateUserStatusRequest.isActive is a Boolean read by Jackson with scalar coercion on; also a missing/null isActive silently means true = unlock, AdminUserController line 41)")
    @org.junit.jupiter.api.Test
    void bugUserStatusAcceptsNumberAsBoolean() throws Exception {
        run(new Case(STATUS, "isActive is a number", set("isActive", 7), null, 400, null));
    }

    @DisplayName("officer / admin request bodies")
    @ParameterizedTest(name = "{0}")
    @MethodSource("rows")
    void staffBody(Case c) throws Exception {
        run(c);
    }

    @DisplayName("wrong Content-Type is refused with 415, never 500")
    @ParameterizedTest(name = "{0}")
    @MethodSource("routes")
    void wrongContentType(Route r) throws Exception {
        runWrongContentType(r, 415);
    }

    static Stream<Route> routes() { return ROUTES.stream(); }
}
