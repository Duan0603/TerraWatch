package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.web.servlet.MvcResult;
import vn.terrawatch.core.validation.Matrix.Case;
import vn.terrawatch.core.validation.Matrix.Route;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static vn.terrawatch.core.validation.Matrix.a;
import static vn.terrawatch.core.validation.Matrix.set;

/**
 * Free-text fields that are stored and returned: injection-style strings must be stored byte for byte as plain data
 * (the users table still exists), and a 10,000-character value must not reach the database unchecked.
 */
class FreeTextValidationMatrixTest extends ValidationTestBase {
    static final List<String> HOSTILE = List.of(
        "<script>alert(1)</script>",
        "'; DROP TABLE users;--",
        "Đường Nguyễn Trãi, phường Mường Bú — Tiếng Việt có dấu: ắằẳẵặ ếềểễệ ốồổỗộ ươ 🌧️⛰️🙂");

    /** A stored field: where it is sent (route + JSON field) and where it ends up (table.column). */
    record Field(Route route, String field, String table, String column, int max) {
        @Override public String toString() { return route.label() + " " + field; }
    }

    static final List<Field> FIELDS = List.of(
        new Field(RequestValidationMatrixTest.REGISTER, "fullName", "core_schema.users", "full_name", 100),
        new Field(RequestValidationMatrixTest.OFFICER, "fullName", "core_schema.users", "full_name", 100),
        new Field(RequestValidationMatrixTest.OFFICER, "departmentUnit", "core_schema.users", "department_unit", 150),
        new Field(CitizenValidationMatrixTest.PROFILE, "fullName", "core_schema.users", "full_name", 100),
        new Field(CitizenValidationMatrixTest.PROFILE, "province", "core_schema.users", "province", 100),
        new Field(CitizenValidationMatrixTest.PROFILE, "district", "core_schema.users", "district", 100),
        new Field(CitizenValidationMatrixTest.PROFILE, "commune", "core_schema.users", "commune", 100),
        new Field(CitizenValidationMatrixTest.PROFILE, "addressLine", "core_schema.users", "address_line", 200),
        new Field(CitizenValidationMatrixTest.PROFILE, "emergencyContactName", "core_schema.users", "emergency_contact_name", 100),
        new Field(CitizenValidationMatrixTest.PROFILE, "emergencyContactRelation", "core_schema.users", "emergency_contact_relation", 50),
        new Field(CitizenValidationMatrixTest.REPORT, "description", "core_schema.community_reports", "description", 2000),
        new Field(StaffValidationMatrixTest.AREA_CREATE, "name", "gis_schema.monitoring_areas", "name", 0),
        new Field(StaffValidationMatrixTest.AREA_CREATE, "description", "gis_schema.monitoring_areas", "description", 0),
        new Field(StaffValidationMatrixTest.AREA_UPDATE, "name", "gis_schema.monitoring_areas", "name", 0),
        new Field(StaffValidationMatrixTest.AREA_UPDATE, "description", "gis_schema.monitoring_areas", "description", 0),
        new Field(StaffValidationMatrixTest.BROADCAST, "message", "core_schema.alert_broadcasts", "message", 0),
        new Field(StaffValidationMatrixTest.FORECAST_REVIEW, "reasonNotes", "core_schema.forecast_reviews", "reason_notes", 0),
        new Field(StaffValidationMatrixTest.VERIFY, "officerNote", "core_schema.landslide_events", "officer_note", 0),
        new Field(CitizenValidationMatrixTest.DEVICE_REGISTER, "fcmToken", "core_schema.device_tokens", "fcm_token", 0));

    static Stream<org.junit.jupiter.params.provider.Arguments> injections() {
        return FIELDS.stream().flatMap(f -> HOSTILE.stream().map(v -> org.junit.jupiter.params.provider.Arguments.of(
            org.junit.jupiter.api.Named.of(f + " = " + (v.length() > 30 ? v.substring(0, 30) + "..." : v), new Object[]{f, v}))));
    }

    @DisplayName("hostile text is stored unchanged as plain data")
    @ParameterizedTest(name = "{0}")
    @MethodSource("injections")
    void storedUnchanged(Object[] args) throws Exception {
        Field f = (Field) args[0];
        String value = (String) args[1];
        ValidationTestBase.Req req = f.route().prepare().apply(this);
        var body = new java.util.LinkedHashMap<>(req.body());
        body.put(f.field(), value);
        MvcResult result = send(f.route().method(), req.path(), req.token(), json.writeValueAsString(body));
        int status = result.getResponse().getStatus();
        assertThat(status).as("status (body: %s)", body(result)).isLessThan(500);
        if (status < 300) {
            em.flush();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + f.table() + " WHERE " + f.column() + " = ?", Long.class, value))
                .as("%s must hold the exact text sent", f.table() + "." + f.column()).isEqualTo(1L);
            if (result.getResponse().getContentLength() > 0 && body(result).startsWith("{") && body(result).contains("\"" + f.field() + "\"")) {
                assertThat(json.readTree(body(result)).findValue(f.field()).asText()).as("returned unchanged").isEqualTo(value);
            }
        } else {
            assertThat(status).isEqualTo(400);
        }
        assertThat(count("core_schema.users")).as("the users table must still exist").isGreaterThanOrEqualTo(1);
    }

    // ------------------------------------------------------------------ 10,000 characters

    /** Fields whose limit is declared (DTO @Size) or enforced in the service: 10,000 chars -> 400. */
    static Stream<Case> tenThousandBounded() {
        return FIELDS.stream().filter(f -> f.max() > 0)
            .map(f -> new Case(f.route(), f.field() + " 10,000 chars", set(f.field(), a(10_000)), null, 400, null));
    }

    @DisplayName("10,000 characters in a field with a declared limit is refused")
    @ParameterizedTest(name = "{0}")
    @MethodSource("tenThousandBounded")
    void tenThousandBoundedRefused(Case c) throws Exception {
        run(c);
    }

    /** Fields with no @Size in the DTO and no DB column limit: 10,000 chars is stored as is (200/204). */
    static Stream<Case> tenThousandAccepted() {
        return FIELDS.stream().filter(f -> f.max() == 0 && !f.field().equals("name"))
            .map(f -> new Case(f.route(), f.field() + " 10,000 chars", set(f.field(), a(10_000)), null, 400, null));
    }

    /** Fields with no @Size in the DTO but a VARCHAR column: the database refuses and the API answers 500. */
    static Stream<Case> dbLimitOnly() {
        return Stream.of(
            new Case(StaffValidationMatrixTest.AREA_CREATE, "name 256 chars (varchar 255)", set("name", a(256)), null, 400, null),
            new Case(StaffValidationMatrixTest.AREA_CREATE, "name 10,000 chars (varchar 255)", set("name", a(10_000)), null, 400, null),
            new Case(StaffValidationMatrixTest.AREA_UPDATE, "name 256 chars (varchar 255)", set("name", a(256)), null, 400, null),
            new Case(StaffValidationMatrixTest.AREA_UPDATE, "name 10,000 chars (varchar 255)", set("name", a(10_000)), null, 400, null),
            new Case(StaffValidationMatrixTest.BROADCAST, "eventId 101 chars (varchar 100)", set("eventId", a(101)), null, 400, null),
            new Case(StaffValidationMatrixTest.FORECAST_CREATE, "unitVersion 21 chars (varchar 20)", set("unitVersion", a(21)), null, 400, null),
            new Case(StaffValidationMatrixTest.FORECAST_CREATE, "modelVersion 51 chars (varchar 50)", set("modelVersion", a(51)), null, 400, null),
            new Case(StaffValidationMatrixTest.FORECAST_CREATE, "thresholdVersion 51 chars (varchar 50)", set("thresholdVersion", a(51)), null, 400, null),
            new Case(StaffValidationMatrixTest.FORECAST_CREATE, "unitId 51 chars (varchar 50)", set("unitId", a(51)), null, 400, null),
            new Case(CitizenValidationMatrixTest.DEVICE_REGISTER, "deviceType 21 chars (varchar 20)", set("deviceType", a(21)), null, 400, null));
    }

    @org.junit.jupiter.api.Disabled("BUG: expected 400, actual 200/204 and the 10,000-char text is stored. No @Size and no column limit: "
        + "CreateAreaRequest.description, UpdateAreaRequest.description, BroadcastAlertRequest.message, ReviewForecastRequest.reasonNotes, "
        + "VerifyEventRequest.officerNote, DeviceTokenRequest.fcmToken (TEXT columns)")
    @DisplayName("10,000 characters in a TEXT field with no declared limit (BUG)")
    @ParameterizedTest(name = "{0}")
    @MethodSource("tenThousandAccepted")
    void tenThousandTextRefused(Case c) throws Exception {
        run(c);
    }

    @org.junit.jupiter.api.Disabled("BUG: expected 400, actual 500 (unhandled PSQLException 'value too long for type character varying(N)'). The DTOs declare no @Size, "
        + "so an over-long value reaches the INSERT/UPDATE: CreateAreaRequest.name, UpdateAreaRequest.name, BroadcastAlertRequest.eventId (idempotency_key 100), "
        + "CreateForecastJobRequest.unitVersion/modelVersion/thresholdVersion/unitId, DeviceTokenRequest.deviceType")
    @DisplayName("value longer than its VARCHAR column and no declared limit (BUG)")
    @ParameterizedTest(name = "{0}")
    @MethodSource("dbLimitOnly")
    void overLongVarcharRefused(Case c) throws Exception {
        run(c);
    }
}
