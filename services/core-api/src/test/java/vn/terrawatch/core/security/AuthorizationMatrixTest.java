package vn.terrawatch.core.security;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.GisServiceClient;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.service.PasswordResetMailer;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Authorization matrix: every mapped /api/v1 route x {anonymous, citizen, officer, admin}.
 * The ROUTES table below IS the specification; it is deliberately not derived from SecurityConfig.
 * SecurityConfig ends with permitAll() on /api/v1/**, so a forgotten route is silently public;
 * routeTableMatchesMappedRoutes() fails when a route is mapped but absent here (or the reverse).
 *
 * Only authorization is asserted (401 / 403 / neither). Allowed callers get a malformed body or a
 * random id so nothing is changed; external senders and the Redis bus are mocked.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AuthorizationMatrixTest {

    enum Tier { PUBLIC, AUTH, STAFF, ADMIN }

    enum Caller { ANONYMOUS, CITIZEN, OFFICER, ADMIN }

    record Route(String method, String path, Tier tier) {
        @Override public String toString() { return method + " " + path; }
    }

    private static Route r(String method, String path, Tier tier) { return new Route(method, path, tier); }

    static final List<Route> ROUTES = List.of(
        // PUBLIC
        r("GET", "/api/v1/auth/email-exists", Tier.PUBLIC),
        r("POST", "/api/v1/auth/google", Tier.PUBLIC),
        r("POST", "/api/v1/auth/login", Tier.PUBLIC),
        r("POST", "/api/v1/auth/officer-requests", Tier.PUBLIC),
        r("POST", "/api/v1/auth/password-reset", Tier.PUBLIC),
        r("POST", "/api/v1/auth/password-reset/check", Tier.PUBLIC),
        r("POST", "/api/v1/auth/password-reset/email/complete", Tier.PUBLIC),
        r("POST", "/api/v1/auth/password-reset/email/request", Tier.PUBLIC),
        r("POST", "/api/v1/auth/password-reset/email/verify", Tier.PUBLIC),
        r("POST", "/api/v1/auth/register", Tier.PUBLIC),
        r("GET", "/api/v1/landslides/active", Tier.PUBLIC),
        r("GET", "/api/v1/landslides/geofence", Tier.PUBLIC),
        r("GET", "/api/v1/landslides/offline-sync", Tier.PUBLIC),
        r("GET", "/api/v1/monitoring-areas", Tier.PUBLIC),
        // AUTH: any signed-in role
        r("GET", "/api/v1/alerts/broadcasts", Tier.AUTH),
        r("DELETE", "/api/v1/alerts/devices", Tier.AUTH),
        r("POST", "/api/v1/alerts/devices/register", Tier.AUTH),
        r("GET", "/api/v1/alerts/subscriptions", Tier.AUTH),
        r("POST", "/api/v1/alerts/subscriptions", Tier.AUTH),
        r("DELETE", "/api/v1/alerts/subscriptions/{id}", Tier.AUTH),
        r("GET", "/api/v1/auth/me", Tier.AUTH),
        r("PUT", "/api/v1/auth/me", Tier.AUTH),
        r("GET", "/api/v1/auth/me/avatar", Tier.AUTH),
        r("PUT", "/api/v1/auth/me/avatar", Tier.AUTH),
        r("DELETE", "/api/v1/auth/me/avatar", Tier.AUTH),
        r("PUT", "/api/v1/auth/password", Tier.AUTH),
        r("POST", "/api/v1/community-reports", Tier.AUTH),
        r("GET", "/api/v1/community-reports/mine", Tier.AUTH),
        r("POST", "/api/v1/community-reports/photos", Tier.AUTH),
        r("GET", "/api/v1/forecasts/active", Tier.AUTH),
        r("GET", "/api/v1/forecasts/offline-sync", Tier.AUTH),
        // STAFF: officer + admin
        r("GET", "/api/v1/community-reports", Tier.STAFF),
        r("GET", "/api/v1/community-reports/photos/{photoId}", Tier.STAFF),
        r("PATCH", "/api/v1/community-reports/{id}/status", Tier.STAFF),
        r("POST", "/api/v1/forecasts", Tier.STAFF),
        r("GET", "/api/v1/forecasts/queue", Tier.STAFF),
        r("GET", "/api/v1/forecasts/review-queue", Tier.STAFF),
        r("GET", "/api/v1/forecasts/reviews/audit", Tier.STAFF),
        r("GET", "/api/v1/forecasts/reviews/metrics", Tier.STAFF),
        r("PATCH", "/api/v1/forecasts/{id}/review", Tier.STAFF),
        r("GET", "/api/v1/landslides/queue", Tier.STAFF),
        r("PATCH", "/api/v1/landslides/{id}/verify", Tier.STAFF),
        r("GET", "/api/v1/model-card", Tier.STAFF),
        r("GET", "/api/v1/stream", Tier.STAFF),
        // ADMIN
        r("GET", "/api/v1/admin/audit", Tier.ADMIN),
        r("GET", "/api/v1/admin/system-health", Tier.ADMIN),
        r("GET", "/api/v1/admin/users", Tier.ADMIN),
        r("POST", "/api/v1/admin/users/{id}/approve", Tier.ADMIN),
        r("POST", "/api/v1/admin/users/{id}/reject", Tier.ADMIN),
        r("PATCH", "/api/v1/admin/users/{id}/role", Tier.ADMIN),
        r("PATCH", "/api/v1/admin/users/{id}/status", Tier.ADMIN),
        r("GET", "/api/v1/diagnostic/circuit-breaker/ai", Tier.ADMIN),
        r("GET", "/api/v1/diagnostic/circuit-breaker/gis", Tier.ADMIN),
        r("POST", "/api/v1/diagnostic/event-bus/publish", Tier.ADMIN),
        r("POST", "/api/v1/monitoring-areas", Tier.ADMIN),
        r("PUT", "/api/v1/monitoring-areas/{id}", Tier.ADMIN),
        r("POST", "/api/v1/notifications/broadcast", Tier.ADMIN),
        r("GET", "/api/v1/notifications/broadcast/preview", Tier.ADMIN),
        r("GET", "/api/v1/notifications/broadcast/{id}/deliveries", Tier.ADMIN),
        r("POST", "/api/v1/notifications/broadcast/{id}/revoke", Tier.ADMIN),
        r("GET", "/api/v1/notifications/broadcasts", Tier.ADMIN));

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired RequestMappingHandlerMapping handlerMapping;
    @Value("${jwt.secret}") String jwtSecret;

    // External side effects stay off, as in the existing API tests.
    @MockBean FcmSender fcm;
    @MockBean SmsSender sms;
    @MockBean PasswordResetMailer mailer;
    @MockBean AiServiceClient ai;
    @MockBean GisServiceClient gis;
    @MockBean EventPublisher eventBus;

    private final String runId = UUID.randomUUID().toString().substring(0, 8);
    private final List<UUID> createdUsers = new ArrayList<>();
    private String citizenToken, officerToken, adminToken;

    @BeforeAll
    void createUsers() {
        citizenToken = tokenFor("citizen");
        officerToken = tokenFor("officer");
        adminToken = tokenFor("admin");
    }

    // Committed rows (this class is not @Transactional); removed again in @AfterAll.
    private String tokenFor(String role) {
        User user = new User("Matrix " + role, "authz-matrix-" + role + "-" + runId + "@example.com",
            "not-a-real-hash", role, null);
        user = users.saveAndFlush(user);
        createdUsers.add(user.getUserId());
        return tokens.generateToken(user);
    }

    @AfterAll
    void deleteUsers() {
        for (UUID id : createdUsers) {
            jdbc.update("DELETE FROM core_schema.users WHERE user_id = ?", id);
        }
    }

    // ---- matrix ----

    static Stream<Arguments> matrix() {
        List<Arguments> out = new ArrayList<>();
        for (Route route : ROUTES) {
            for (Caller caller : Caller.values()) {
                out.add(Arguments.of(route, caller, expected(route.tier(), caller)));
            }
        }
        return out.stream();
    }

    /** "401", "403" or "allowed" (anything but 401/403). */
    static String expected(Tier tier, Caller caller) {
        return switch (tier) {
            case PUBLIC -> "allowed";
            case AUTH -> caller == Caller.ANONYMOUS ? "401" : "allowed";
            case STAFF -> switch (caller) {
                case ANONYMOUS -> "401";
                case CITIZEN -> "403";
                default -> "allowed";
            };
            case ADMIN -> switch (caller) {
                case ANONYMOUS -> "401";
                case CITIZEN, OFFICER -> "403";
                case ADMIN -> "allowed";
            };
        };
    }

    @ParameterizedTest(name = "{0} as {1} -> {2}")
    @MethodSource("matrix")
    void routeAccess(Route route, Caller caller, String expected) throws Exception {
        // Routes guarded only by @PreAuthorize are checked AFTER Spring binds and validates the body, so a denied
        // caller needs a well-formed body to reach the check (else 400 hides the verdict). Allowed callers keep the
        // malformed body, so nothing is created or changed.
        boolean denied = !expected.equals("allowed");
        MvcResult result = send(route.method(), concrete(route.path()), tokenOf(caller),
            denied ? WELL_FORMED_BODY.get(route.toString()) : null);
        int status = result.getResponse().getStatus();
        switch (expected) {
            case "401" -> assertEquals(401, status, route + " as " + caller);
            case "403" -> assertEquals(403, status, route + " as " + caller);
            default -> assertTrue(status != 401 && status != 403,
                route + " as " + caller + " must pass authorization but got " + status);
        }
    }

    private String tokenOf(Caller caller) {
        return switch (caller) {
            case ANONYMOUS -> null;
            case CITIZEN -> citizenToken;
            case OFFICER -> officerToken;
            case ADMIN -> adminToken;
        };
    }

    private static final java.util.Map<String, String> WELL_FORMED_BODY = java.util.Map.of(
        "PATCH /api/v1/community-reports/{id}/status", "{\"status\":\"processed\"}",
        "POST /api/v1/forecasts", "{\"unitId\":\"u\",\"modelVersion\":\"m\",\"thresholdVersion\":\"t\"}",
        "PATCH /api/v1/forecasts/{id}/review", "{\"decision\":\"approved\"}");

    private MvcResult send(Route route, String token) throws Exception {
        return send(route.method(), concrete(route.path()), token, null);
    }

    private MvcResult send(String method, String path, String token, String wellFormedBody) throws Exception {
        MockHttpServletRequestBuilder req = request(HttpMethod.valueOf(method), path);
        if (token != null) req.header("Authorization", "Bearer " + token);
        // A malformed JSON body: an allowed caller gets 400 before any controller code runs, so no data changes.
        if (wellFormedBody != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(wellFormedBody);
        } else if (!method.equals("GET") && !method.equals("DELETE") || path.endsWith("/devices")) {
            req.contentType(MediaType.APPLICATION_JSON).content("{");
        }
        return mvc.perform(req).andReturn(); // SSE: returns once the request is async-started; no hang
    }

    /** A path variable that matches no row: int ids for the legacy tables, UUID elsewhere. */
    private static String concrete(String template) {
        String numeric = template.contains("/monitoring-areas/") || template.startsWith("/api/v1/community-reports/{id}")
            || template.startsWith("/api/v1/landslides/") ? "987654321" : null;
        String uuid = "00000000-0000-0000-0000-000000000000";
        return template.replace("{id}", numeric != null ? numeric : uuid).replace("{photoId}", uuid);
    }

    // ---- guard ----

    @Test
    void routeTableMatchesMappedRoutes() {
        Set<String> mapped = new TreeSet<>();
        for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
            Set<String> patterns = info.getPathPatternsCondition() != null
                ? info.getPathPatternsCondition().getPatternValues() : Set.of();
            Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
            for (String pattern : patterns) {
                if (!pattern.startsWith("/api/v1")) continue;
                if (methods.isEmpty()) mapped.add("ANY " + pattern);
                for (RequestMethod m : methods) mapped.add(m + " " + pattern);
            }
        }
        Set<String> table = new TreeSet<>();
        for (Route route : ROUTES) {
            assertTrue(table.add(route.toString()), "Duplicate matrix row: " + route);
        }
        Set<String> missing = new TreeSet<>(mapped);
        missing.removeAll(table);
        Set<String> stale = new TreeSet<>(table);
        stale.removeAll(mapped);
        assertTrue(missing.isEmpty() && stale.isEmpty(),
            "Authorization matrix out of date. Mapped but NOT in the matrix (add with an explicit tier, "
                + "and mind the blanket permitAll in SecurityConfig): " + missing
                + "; in the matrix but no longer mapped: " + stale);
        System.out.println("AUTHZ-MATRIX routes mapped under /api/v1: " + mapped.size() + ", matrix rows: " + table.size());
    }

    // ---- token state ----

    private static final Route AUTH_ROUTE = r("GET", "/api/v1/auth/me", Tier.AUTH);
    private static final Route STAFF_ROUTE = r("GET", "/api/v1/forecasts/review-queue", Tier.STAFF);
    private static final Route ADMIN_ROUTE = r("GET", "/api/v1/admin/users", Tier.ADMIN);

    private String badToken(String kind) {
        User admin = users.findById(createdUsers.get(2)).orElseThrow();
        return switch (kind) {
            case "expired" -> new JwtTokenProvider(jwtSecret, -60_000).generateToken(admin);
            case "other-key" -> new JwtTokenProvider(jwtSecret + "-other", 60_000).generateToken(admin);
            default -> { // tampered: flip the FIRST signature char (the last one only carries padding bits)
                String valid = tokens.generateToken(admin);
                int sig = valid.lastIndexOf('.') + 1;
                char c = valid.charAt(sig) == 'A' ? 'B' : 'A';
                yield valid.substring(0, sig) + c + valid.substring(sig + 1);
            }
        };
    }

    static Stream<Arguments> protectedRoutes() {
        return Stream.of(AUTH_ROUTE, STAFF_ROUTE, ADMIN_ROUTE).map(Arguments::of);
    }

    @ParameterizedTest(name = "{0} with expired token -> 401")
    @MethodSource("protectedRoutes")
    void expiredTokenIsRejected(Route route) throws Exception {
        assertEquals(401, send(route, badToken("expired")).getResponse().getStatus());
    }

    @ParameterizedTest(name = "{0} with tampered signature -> 401")
    @MethodSource("protectedRoutes")
    void tamperedSignatureIsRejected(Route route) throws Exception {
        assertEquals(401, send(route, badToken("tampered")).getResponse().getStatus());
    }

    @ParameterizedTest(name = "{0} with token signed by another key -> 401")
    @MethodSource("protectedRoutes")
    void foreignKeyTokenIsRejected(Route route) throws Exception {
        assertEquals(401, send(route, badToken("other-key")).getResponse().getStatus());
    }

    @ParameterizedTest(name = "{0} with malformed Authorization header -> 401")
    @MethodSource("protectedRoutes")
    void malformedAuthorizationHeaderIsRejected(Route route) throws Exception {
        for (String header : new String[]{"Bearer", "Bearer ", "Bearer not.a.jwt", "Basic dXNlcjpwYXNz", "garbage", "bearer"}) {
            int status = mvc.perform(request(HttpMethod.GET, route.path()).header("Authorization", header))
                .andReturn().getResponse().getStatus();
            assertEquals(401, status, "header [" + header + "] on " + route);
        }
    }

    @Test
    void publicRouteIgnoresGarbageBearerToken() throws Exception {
        int status = mvc.perform(request(HttpMethod.GET, "/api/v1/landslides/active")
                .header("Authorization", "Bearer garbage.token.value"))
            .andReturn().getResponse().getStatus();
        assertTrue(status != 401 && status != 403, "public route returned " + status);
    }
}
