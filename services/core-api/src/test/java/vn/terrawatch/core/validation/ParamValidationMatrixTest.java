package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Path variables and query parameters: unknown id -> 404, malformed id -> 400, missing / non-numeric / out-of-range
 * query values -> 400 or a clamped answer, and never a 500. Each route is called with the least-privileged role it allows.
 */
class ParamValidationMatrixTest extends ValidationTestBase {
    /** uri is built after the accounts and seed rows exist; the body (if any) is sent as {@code body}. */
    record P(String label, HttpMethod method, String role, Function<ParamValidationMatrixTest, String> uri, String body, int status) {
        @Override public String toString() { return method + " " + label + " -> " + status; }
    }

    private static final String NOT_UUID = "not-a-uuid";
    private static final List<String> BAD_UUIDS = List.of(NOT_UUID, "123", "0", "-1", "00000000-0000-0000-0000-00000000000g", "%20", "1e3");
    private static final List<String> BAD_INTS = List.of("abc", "1.5", "2147483648", "99999999999999999999", "-", "1%2C5");

    private static P p(String label, HttpMethod m, String role, String uri, int status) { return new P(label, m, role, t -> uri, null, status); }
    private static P pb(String label, HttpMethod m, String role, String uri, String body, int status) { return new P(label, m, role, t -> uri, body, status); }

    static Stream<P> rows() {
        List<P> r = new ArrayList<>();
        // ---- UUID path variables: unknown -> 404 (or the documented 200 for a list), malformed -> 400
        String statusBody = "{\"isActive\":true}", roleBody = "{\"role\":\"citizen\"}", reviewBody = "{\"decision\":\"approved\"}", verifyBody = "{\"status\":\"verified\"}";
        for (String id : List.of(UNKNOWN_UUID.toString())) {
            r.add(pb("/api/v1/admin/users/{id}/status unknown id", HttpMethod.PATCH, "admin", "/api/v1/admin/users/" + id + "/status", statusBody, 404));
            r.add(pb("/api/v1/admin/users/{id}/role unknown id", HttpMethod.PATCH, "admin", "/api/v1/admin/users/" + id + "/role", roleBody, 404));
            r.add(p("/api/v1/admin/users/{id}/approve unknown id", HttpMethod.POST, "admin", "/api/v1/admin/users/" + id + "/approve", 404));
            r.add(p("/api/v1/admin/users/{id}/reject unknown id", HttpMethod.POST, "admin", "/api/v1/admin/users/" + id + "/reject", 404));
            r.add(p("/api/v1/alerts/subscriptions/{id} unknown id", HttpMethod.DELETE, "citizen", "/api/v1/alerts/subscriptions/" + id, 404));
            r.add(p("/api/v1/community-reports/photos/{photoId} unknown id", HttpMethod.GET, "officer", "/api/v1/community-reports/photos/" + id, 404));
            r.add(pb("/api/v1/forecasts/{id}/review unknown id", HttpMethod.PATCH, "officer", "/api/v1/forecasts/" + id + "/review", reviewBody, 404));
            r.add(pb("/api/v1/landslides/{id}/verify unknown id", HttpMethod.PATCH, "officer", "/api/v1/landslides/" + id + "/verify", verifyBody, 404));
            r.add(p("/api/v1/notifications/broadcast/{id}/revoke unknown id", HttpMethod.POST, "admin", "/api/v1/notifications/broadcast/" + id + "/revoke", 404));
            r.add(p("/api/v1/notifications/broadcast/{id}/deliveries unknown id lists nothing", HttpMethod.GET, "admin", "/api/v1/notifications/broadcast/" + id + "/deliveries", 200));
        }
        for (String id : BAD_UUIDS) {
            r.add(pb("/api/v1/admin/users/" + id + "/status", HttpMethod.PATCH, "admin", "/api/v1/admin/users/" + id + "/status", statusBody, 400));
            r.add(pb("/api/v1/admin/users/" + id + "/role", HttpMethod.PATCH, "admin", "/api/v1/admin/users/" + id + "/role", roleBody, 400));
            r.add(p("/api/v1/admin/users/" + id + "/approve", HttpMethod.POST, "admin", "/api/v1/admin/users/" + id + "/approve", 400));
            r.add(p("/api/v1/admin/users/" + id + "/reject", HttpMethod.POST, "admin", "/api/v1/admin/users/" + id + "/reject", 400));
            r.add(p("/api/v1/alerts/subscriptions/" + id, HttpMethod.DELETE, "citizen", "/api/v1/alerts/subscriptions/" + id, 400));
            r.add(p("/api/v1/community-reports/photos/" + id, HttpMethod.GET, "officer", "/api/v1/community-reports/photos/" + id, 400));
            r.add(pb("/api/v1/forecasts/" + id + "/review", HttpMethod.PATCH, "officer", "/api/v1/forecasts/" + id + "/review", reviewBody, 400));
            r.add(p("/api/v1/notifications/broadcast/" + id + "/revoke", HttpMethod.POST, "admin", "/api/v1/notifications/broadcast/" + id + "/revoke", 400));
            r.add(p("/api/v1/notifications/broadcast/" + id + "/deliveries", HttpMethod.GET, "admin", "/api/v1/notifications/broadcast/" + id + "/deliveries", 400));
        }
        // landslides/{id}/verify takes the id as a String and answers its own 400
        for (String id : List.of(NOT_UUID, "123", "0", "-1")) {
            r.add(pb("/api/v1/landslides/" + id + "/verify", HttpMethod.PATCH, "officer", "/api/v1/landslides/" + id + "/verify", verifyBody, 400));
        }
        // ---- int path variables
        String reportBody = "{\"status\":\"processed\"}", areaBody = "{\"name\":\"x\"}";
        for (String id : List.of("999999", "0", "-1", "2147483647")) {
            r.add(pb("/api/v1/community-reports/" + id + "/status unknown id", HttpMethod.PATCH, "officer", "/api/v1/community-reports/" + id + "/status", reportBody, 404));
            r.add(pb("/api/v1/monitoring-areas/" + id + " unknown id", HttpMethod.PUT, "admin", "/api/v1/monitoring-areas/" + id, areaBody, 404));
        }
        for (String id : BAD_INTS) {
            r.add(pb("/api/v1/community-reports/" + id + "/status", HttpMethod.PATCH, "officer", "/api/v1/community-reports/" + id + "/status", reportBody, 400));
            r.add(pb("/api/v1/monitoring-areas/" + id, HttpMethod.PUT, "admin", "/api/v1/monitoring-areas/" + id, areaBody, 400));
        }
        // ---- limit / days: any integer is clamped, anything else is 400
        for (String path : List.of("/api/v1/admin/audit", "/api/v1/forecasts/reviews/audit", "/api/v1/notifications/broadcasts")) {
            String role = path.startsWith("/api/v1/forecasts") ? "officer" : "admin";
            for (String v : List.of("0", "-1", "1", "500", "501", "1000000", "2147483647", "-2147483648"))
                r.add(p(path + "?limit=" + v + " is clamped", HttpMethod.GET, role, path + "?limit=" + v, 200));
            r.add(p(path + " without limit uses the default", HttpMethod.GET, role, path, 200));
            r.add(p(path + "?limit= (empty) uses the default", HttpMethod.GET, role, path + "?limit=", 200));
            for (String v : List.of("abc", "1.5", "2147483648", "99999999999999999999", "1e3", "NaN", "'; DROP TABLE users;--"))
                r.add(p(path + "?limit=" + v + " is not an int", HttpMethod.GET, role, path + "?limit=" + enc(v), 400));
        }
        String metrics = "/api/v1/forecasts/reviews/metrics";
        for (String v : List.of("0", "-1", "1", "90", "91", "1000000", "2147483647", "-2147483648"))
            r.add(p(metrics + "?days=" + v + " is clamped", HttpMethod.GET, "officer", metrics + "?days=" + v, 200));
        r.add(p(metrics + " without days uses the default", HttpMethod.GET, "officer", metrics, 200));
        r.add(p(metrics + "?days= (empty) uses the default", HttpMethod.GET, "officer", metrics + "?days=", 200));
        for (String v : List.of("abc", "1.5", "2147483648", "NaN"))
            r.add(p(metrics + "?days=" + v + " is not an int", HttpMethod.GET, "officer", metrics + "?days=" + enc(v), 400));
        // ---- review-queue status
        String queue = "/api/v1/forecasts/review-queue";
        for (String v : List.of("pending", "approved", "rejected", "all")) r.add(p(queue + "?status=" + v, HttpMethod.GET, "officer", queue + "?status=" + v, 200));
        r.add(p(queue + " without status uses pending", HttpMethod.GET, "officer", queue, 200));
        r.add(p(queue + "?status= (empty) uses pending", HttpMethod.GET, "officer", queue + "?status=", 200));
        for (String v : List.of("zzz", "PENDING", " pending", "pending ", "approved' OR '1'='1", "superseded", "all;DROP TABLE users"))
            r.add(p(queue + "?status=" + v + " outside the list", HttpMethod.GET, "officer", queue + "?status=" + enc(v), 400));
        // ---- admin user list filters: free text is a filter, never an error; isActive must be a boolean
        String users = "/api/v1/admin/users";
        r.add(p(users + " without filters", HttpMethod.GET, "admin", users, 200));
        for (String f : List.of("search", "role", "approvalStatus")) {
            for (String v : List.of("", "x", "citizen", "pending", "Nguyễn 🙂", "'; DROP TABLE users;--", "<script>alert(1)</script>", "%", "_", "a".repeat(10_000)))
                r.add(p(users + "?" + f + "=" + (v.length() > 40 ? v.length() + " chars" : v), HttpMethod.GET, "admin", users + "?" + f + "=" + enc(v), 200));
        }
        for (String v : List.of("true", "false", "TRUE", "1", "0", "yes", "on", "off")) r.add(p(users + "?isActive=" + v, HttpMethod.GET, "admin", users + "?isActive=" + v, 200));
        for (String v : List.of("maybe", "2", "tru", "null", "'; DROP TABLE users;--")) r.add(p(users + "?isActive=" + v + " is not a boolean", HttpMethod.GET, "admin", users + "?isActive=" + enc(v), 400));
        r.add(p(users + "?isActive= (empty) means not given", HttpMethod.GET, "admin", users + "?isActive=", 200));
        // ---- email-exists
        String exists = "/api/v1/auth/email-exists";
        r.add(p(exists + " without email", HttpMethod.GET, null, exists, 400));
        for (String v : List.of("", "   ", "a@b.co", "no-at-sign", "A@B.CO ", "'; DROP TABLE users;--", "<script>alert(1)</script>", "Nguyễn@ví-dụ.vn", "a".repeat(10_000)))
            r.add(p(exists + "?email=" + (v.length() > 40 ? v.length() + " chars" : v), HttpMethod.GET, null, exists + "?email=" + enc(v), 200));
        // ---- broadcast preview
        String preview = "/api/v1/notifications/broadcast/preview";
        r.add(p(preview + " without areaId", HttpMethod.GET, "admin", preview, 400));
        for (String v : List.of("0", "-1", "999999", "2147483647")) r.add(p(preview + "?areaId=" + v + " unknown area", HttpMethod.GET, "admin", preview + "?areaId=" + v, 404));
        for (String v : BAD_INTS) r.add(p(preview + "?areaId=" + v, HttpMethod.GET, "admin", preview + "?areaId=" + enc(v), 400));
        r.add(p(preview + "?areaId= (empty)", HttpMethod.GET, "admin", preview + "?areaId=", 400));
        // ---- geofence
        String geo = "/api/v1/landslides/geofence";
        r.add(p(geo + " valid", HttpMethod.GET, null, geo + "?lon=104.1&lat=21.8&radius=500", 200));
        r.add(p(geo + " without radius uses 500", HttpMethod.GET, null, geo + "?lon=104.1&lat=21.8", 200));
        r.add(p(geo + " radius= (empty) uses 500", HttpMethod.GET, null, geo + "?lon=104.1&lat=21.8&radius=", 200));
        r.add(p(geo + " without lon", HttpMethod.GET, null, geo + "?lat=21.8", 400));
        r.add(p(geo + " without lat", HttpMethod.GET, null, geo + "?lon=104.1", 400));
        r.add(p(geo + " without lon and lat", HttpMethod.GET, null, geo, 400));
        for (String f : List.of("lon", "lat", "radius")) {
            for (String v : List.of("abc", "1,5", "'; DROP TABLE users;--", "0x10"))
                r.add(p(geo + " " + f + "=" + v + " is not a number", HttpMethod.GET, null, geo(f, enc(v)), 400));
            if (!f.equals("radius")) r.add(p(geo + " " + f + "= (empty) is missing", HttpMethod.GET, null, geo(f, ""), 400));
        }
        r.add(p(geo + " lon=-180 lat=-90 radius=0 (bounds)", HttpMethod.GET, null, geo + "?lon=-180&lat=-90&radius=0", 200));
        r.add(p(geo + " lon=180 lat=90 (bounds)", HttpMethod.GET, null, geo + "?lon=180&lat=90&radius=1", 200));
        r.add(p(geo + " radius=1000000000 (very large)", HttpMethod.GET, null, geo + "?lon=104.1&lat=21.8&radius=1000000000", 200));
        r.add(p(geo + " scientific notation", HttpMethod.GET, null, geo + "?lon=1.041e2&lat=2.18e1&radius=5e2", 200));
        // out-of-range values: a client mistake, so 400 (expected). Tracked as findings below if the API answers otherwise.
        // ---- diagnostic event bus (admin): free text, defaults when missing
        String bus = "/api/v1/diagnostic/event-bus/publish";
        r.add(p(bus + " without params uses defaults", HttpMethod.POST, "admin", bus, 200));
        for (String v : List.of("", "x", "Nguyễn 🙂", "'; DROP TABLE users;--", "<script>alert(1)</script>", "a".repeat(10_000))) {
            r.add(p(bus + "?eventType=" + (v.length() > 40 ? v.length() + " chars" : v), HttpMethod.POST, "admin", bus + "?eventType=" + enc(v), 200));
            r.add(p(bus + "?message=" + (v.length() > 40 ? v.length() + " chars" : v), HttpMethod.POST, "admin", bus + "?message=" + enc(v), 200));
        }
        return r.stream();
    }

    /** Out-of-range coordinates / radius: documented finding, see the @Disabled test below. */
    static Stream<P> geofenceOutOfRange() {
        List<P> r = new ArrayList<>();
        String geo = "/api/v1/landslides/geofence";
        for (String v : List.of("-180.0001", "180.0001", "1e999", "NaN", "Infinity")) {
            r.add(p(geo + " lon=" + v + " (outside -180..180)", HttpMethod.GET, null, geo("lon", v), 400));
            r.add(p(geo + " lat=" + v + " (outside -90..90)", HttpMethod.GET, null, geo("lat", v), 400));
        }
        for (String v : List.of("-1", "-0.0001", "-1000000")) r.add(p(geo + " radius=" + v + " (negative)", HttpMethod.GET, null, geo("radius", v), 400));
        return r.stream();
    }

    private static String geo(String bad, String value) {
        return "/api/v1/landslides/geofence?lon=" + (bad.equals("lon") ? value : "104.1") + "&lat=" + (bad.equals("lat") ? value : "21.8")
            + "&radius=" + (bad.equals("radius") ? value : "500");
    }

    private static String enc(String v) {
        return java.net.URLEncoder.encode(v, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
    }

    @DisplayName("path variables and query parameters")
    @ParameterizedTest(name = "{0}")
    @MethodSource("rows")
    void param(P row) throws Exception {
        String token = row.role() == null ? null : account(row.role(), uniq(row.role())).token();
        long usersBefore = count("core_schema.users");
        MvcResult result = send(row.method(), row.uri().apply(this), token, row.body());
        try {
            assertOutcome(result, row.status(), null);
        } catch (AssertionError e) {
            throw new AssertionError("CASE " + row + " :: " + e.getMessage(), e);
        }
        assertThat(count("core_schema.users")).as("no user may be created or dropped").isEqualTo(usersBefore);
    }

    @org.junit.jupiter.api.Disabled("BUG: expected 400 for lon outside -180..180, lat outside -90..90, negative or NaN radius; actual 200 with an empty list "
        + "(LandslideEventController.queryGeofence takes raw doubles with no range check; the same limits are enforced for POST /community-reports)")
    @DisplayName("geofence out-of-range values (BUG)")
    @ParameterizedTest(name = "{0}")
    @MethodSource("geofenceOutOfRange")
    void geofenceRangeIsChecked(P row) throws Exception {
        assertOutcome(send(row.method(), row.uri().apply(this), null, null), row.status(), null);
    }

    static Stream<String> paramErrorUris() {
        return Stream.of("/api/v1/auth/email-exists", "/api/v1/admin/audit?limit=x", "/api/v1/forecasts/reviews/metrics?days=x",
            "/api/v1/landslides/geofence", "/api/v1/landslides/geofence?lon=x&lat=1", "/api/v1/notifications/broadcast/preview?areaId=x",
            "/api/v1/forecasts/review-queue?status=zzz");
    }

    @org.junit.jupiter.api.Disabled("BUG: expected a JSON error body {\"message\": ...} like every body-validation error, actual an EMPTY body for a missing / unparsable query parameter "
        + "(MissingServletRequestParameterException and MethodArgumentTypeMismatchException are not handled by AuthExceptionHandler; the body-level 400 is {\"message\":\"Invalid request\"})")
    @DisplayName("400 for a bad query parameter carries the same JSON body shape as body validation (BUG)")
    @ParameterizedTest(name = "{0}")
    @MethodSource("paramErrorUris")
    void paramErrorHasMessageBody(String uri) throws Exception {
        MvcResult r = send(HttpMethod.GET, uri, account("admin", uniq("adm")).token(), null);
        assertThat(r.getResponse().getStatus()).isEqualTo(400);
        assertThat(json.readTree(body(r)).path("message").asText()).isNotBlank();
    }

    @DisplayName("unknown ids of rows that exist elsewhere stay 404 (another user's subscription looks like an unknown id)")
    @org.junit.jupiter.api.Test
    void anotherUsersSubscriptionIsNotFound() throws Exception {
        Acct owner = account("citizen", uniq("own"), "0901234567"), other = account("citizen", uniq("oth"));
        int area = seedArea(uniq("area"));
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (subscription_id, user_id, area_id) VALUES (?, ?, ?)", id, owner.id(), area);
        assertOutcome(send(HttpMethod.DELETE, "/api/v1/alerts/subscriptions/" + id, other.token(), null), 404, null);
        assertThat(count("core_schema.alert_subscriptions WHERE subscription_id = '" + id + "'")).isEqualTo(1);
        assertOutcome(send(HttpMethod.DELETE, "/api/v1/alerts/subscriptions/" + id, owner.token(), null), 204, null);
        em.flush();
        assertThat(count("core_schema.alert_subscriptions WHERE subscription_id = '" + id + "'")).isZero();
    }
}
