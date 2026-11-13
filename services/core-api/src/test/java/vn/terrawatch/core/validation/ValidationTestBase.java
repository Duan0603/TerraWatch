package vn.terrawatch.core.validation;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import vn.terrawatch.core.security.JwtTokenProvider;
import vn.terrawatch.core.service.PasswordResetMailer;

import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Shared plumbing for the request-validation matrix: boots the context once (all external senders mocked),
 * builds users per role with real JWTs, and runs one table row ({@link Case}) against one {@link Route}.
 * Every test runs in a rolled-back transaction, so no rows survive.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
abstract class ValidationTestBase {
    static final String PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    static final UUID UNKNOWN_UUID = UUID.fromString("00000000-0000-4000-8000-00000000dead");
    /** Anything that looks like a stack trace, SQL, or a Java class name in an error body is a leak. */
    private static final Pattern LEAK = Pattern.compile(
        "(?i)(\\bat [a-z0-9_.$]+\\([A-Za-z0-9_]+\\.java|org\\.springframework|org\\.postgresql|org\\.hibernate|jakarta\\.|java\\.lang\\.|vn\\.terrawatch|PSQLException|SQLException|\\bSELECT\\b.*\\bFROM\\b|\\bINSERT INTO\\b|Exception:|stacktrace)");
    private static String passwordHash;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired BCryptPasswordEncoder encoder;
    @PersistenceContext EntityManager em;
    @MockBean FcmSender fcm;
    @MockBean SmsSender sms;
    @MockBean FirebaseIdTokenVerifier verifier;
    @MockBean PasswordResetMailer mailer;
    @MockBean AiServiceClient ai;
    @MockBean EventPublisher events;

    @BeforeEach
    void stubExternals() {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.sent("MOCK_SID"));
        when(mailer.configured()).thenReturn(true);
        // phone token "ok:<phone>" proves that phone; anything else is rejected like the real verifier does
        when(verifier.verifyPhoneToken(anyString())).thenAnswer(inv -> {
            String token = inv.getArgument(0);
            if (token.startsWith("ok:")) return token.substring(3);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid phone token");
        });
        // Google token "good-..." is a verified identity named after its length; anything else is a 401
        when(verifier.verify(anyString())).thenAnswer(inv -> {
            String token = inv.getArgument(0);
            if (token.startsWith("good-")) return new FirebaseIdTokenVerifier.GoogleIdentity("google-" + token.length() + "@validation.example", "Google User");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
        });
    }

    // ---------------------------------------------------------------- accounts

    record Acct(User user, String token) {
        UUID id() { return user.getUserId(); }
    }

    Acct account(String role, String tag) { return account(role, tag, null); }

    /** Password of every account is "secret123". */
    Acct account(String role, String tag, String phone) {
        if (passwordHash == null) passwordHash = encoder.encode("secret123");
        User user = users.saveAndFlush(new User("Validation " + tag, tag + "@validation.example", passwordHash, role, phone));
        return new Acct(user, tokens.generateToken(user));
    }

    /** A password-reset row for the user: code "123456" unverified, or (verified=true) holding the token "reset-token". */
    void seedResetCode(UUID userId, boolean verified) {
        jdbc.update("""
            INSERT INTO core_schema.password_reset_codes (user_id, code_hash, reset_token_hash, expires_at, verified_at)
            VALUES (?, ?, ?, now() + interval '10 minutes', CASE WHEN ? THEN now() END)
            """, userId, encoder.encode("123456"), verified ? sha256("reset-token") : null, verified);
    }

    static String sha256(String text) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    // ---------------------------------------------------------------- seeds

    void seedUnit(String id) {
        jdbc.update("""
            INSERT INTO gis_schema.spatial_assessment_units (unit_id, admin_province, admin_district, geom)
            VALUES (?, 'Lao Cai', 'Bat Xat', ST_GeomFromText('POLYGON((103.9 22.5, 104.0 22.5, 104.0 22.6, 103.9 22.6, 103.9 22.5))', 4326))
            """, id);
    }

    UUID seedPendingRun(String unitId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.forecast_runs (run_id, unit_id, issued_at, valid_from, valid_until, availability, probability,
                hazard_level, model_version, threshold_version, review_status, is_active, job_status, idempotency_key)
            VALUES (?, ?, now(), now() - interval '1 hour', now() + interval '23 hours', 'available', 0.8, 'high', 'm', 't',
                'pending', true, 'completed', ?)
            """, id, unitId, "key-" + id);
        return id;
    }

    int seedReport(UUID userId) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.community_reports (user_id, location, description, status)
            VALUES (?, ST_SetSRID(ST_MakePoint(104.1, 21.8), 4326), 'seed', 'submitted') RETURNING report_id
            """, Integer.class, userId);
    }

    int seedArea(String name) {
        return jdbc.queryForObject("""
            INSERT INTO gis_schema.monitoring_areas (name, description, geom)
            VALUES (?, 'seed', ST_Multi(ST_GeomFromText('POLYGON((105 21, 105.1 21, 105.1 21.1, 105 21.1, 105 21))', 4326))) RETURNING area_id
            """, Integer.class, name);
    }

    /** A citizen with a registered phone token and a push subscription to the area, so a broadcast has a real recipient. */
    void seedSubscriber(int areaId) {
        Acct citizen = account("citizen", "subscriber-" + areaId);
        jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES (?, ?)", "seed-token-" + areaId, citizen.id());
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, false)", citizen.id(), areaId);
    }

    long count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
    }

    // ---------------------------------------------------------------- values

    static String str(int length) { return "a".repeat(length); }

    /** Valid e-mail of exactly {@code length} chars (64-char local part, dotted labels of at most 60), to hit @Size(max = 150) precisely. */
    static String emailOfLength(int length) {
        String local = "l".repeat(64) + "@";
        int labelsTotal = length - local.length() - ".com".length();
        int count = (labelsTotal + 60) / 61 + 1; // labels of ~60 chars plus their dots
        int chars = labelsTotal - (count - 1);
        StringBuilder host = new StringBuilder();
        for (int i = 0; i < count; i++) {
            int share = chars / count + (i < chars % count ? 1 : 0);
            host.append("d".repeat(share)).append('.');
        }
        String email = local + host + "com";
        assertThat(email).hasSize(length);
        return email;
    }

    static String image(int decodedBytes, boolean png) {
        byte[] bytes = new byte[decodedBytes];
        byte[] magic = png ? new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D} : new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};
        System.arraycopy(magic, 0, bytes, 0, magic.length);
        return Base64.getEncoder().encodeToString(bytes);
    }

    // ---------------------------------------------------------------- running

    String uniq(String prefix) { return prefix + "-" + UUID.randomUUID().toString().substring(0, 8); }

    /** A prepared request: where, who, the valid base body, and a cheap "what is in the DB" probe. */
    record Req(String path, String token, Map<String, Object> body, Supplier<Object> snapshot, boolean createsOnSuccess) {}

    MvcResult send(HttpMethod method, String uri, String token, String rawBody) throws Exception {
        return send(method, uri, token, rawBody, MediaType.APPLICATION_JSON);
    }

    MvcResult send(HttpMethod method, String uri, String token, String rawBody, MediaType type) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, uri);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (rawBody != null) builder.contentType(type).content(rawBody);
        try {
            return mvc.perform(builder).andReturn();
        } catch (jakarta.servlet.ServletException unhandled) {
            // MockMvc rethrows what a real server would turn into a 500
            Throwable root = unhandled;
            while (root.getCause() != null) root = root.getCause();
            throw new AssertionError(method + " " + uri + " -> unhandled exception, a real server answers 500: " + root, unhandled);
        }
    }

    static Map<String, Object> map(Object... keyValues) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) m.put((String) keyValues[i], keyValues[i + 1]);
        return m;
    }

    /** Request whose "what is stored" probe is a row count of {@code table}; the valid request must add one row. */
    Req creating(String path, Acct as, Map<String, Object> body, String table) {
        return new Req(path, as == null ? null : as.token(), body, () -> count(table), true);
    }

    /** Request whose probe is any single value (a column, a status); only rejected requests are checked against it. */
    Req probing(String path, Acct as, Map<String, Object> body, Supplier<Object> probe) {
        return new Req(path, as == null ? null : as.token(), body, probe, false);
    }

    Req plain(String path, Acct as, Map<String, Object> body) {
        return new Req(path, as == null ? null : as.token(), body, null, false);
    }

    Object column(String sql, Object... args) {
        return jdbc.queryForObject(sql, Object.class, args);
    }

    String body(MvcResult r) throws Exception { return r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8); }

    Object snapshot(Req req) {
        if (req.snapshot() == null) return null;
        em.flush(); // service code saves through JPA; the probes read with plain SQL
        return req.snapshot().get();
    }

    /** Status must match exactly; a 5xx or a body that leaks internals fails with the body in the message. */
    void assertOutcome(MvcResult result, int expected, String message) throws Exception {
        int actual = result.getResponse().getStatus();
        String body = body(result);
        assertThat(actual).as("status (body: %s)", body).isEqualTo(expected);
        assertThat(actual).as("client input must never cause a server error").isLessThan(500);
        assertThat(body).as("error body must not leak internals").doesNotContainPattern(LEAK);
        if (message != null) assertThat(json.readTree(body).path("message").asText()).isEqualTo(message);
    }

    /** A body sent as text/plain is refused with a client error (never a 500) and nothing is changed. */
    void runWrongContentType(Matrix.Route route, int expected) throws Exception {
        Req req = route.prepare().apply(this);
        Object before = snapshot(req);
        MvcResult result = send(route.method(), req.path(), req.token(), json.writeValueAsString(req.body()), MediaType.TEXT_PLAIN);
        assertOutcome(result, expected, null);
        if (before != null) assertThat(snapshot(req)).isEqualTo(before);
    }

    /** Runs one table row: valid base request, edited per the row, then the status / message / persistence checks. */
    void run(Matrix.Case c) throws Exception {
        try {
            runUnlabelled(c);
        } catch (AssertionError e) {
            throw new AssertionError("CASE " + c + " :: " + e.getMessage(), e);
        }
    }

    private void runUnlabelled(Matrix.Case c) throws Exception {
        Req req = c.route().prepare().apply(this);
        String raw = c.raw() != null ? c.raw() : json.writeValueAsString(c.edit().apply(new LinkedHashMap<>(req.body())));
        Object before = snapshot(req);
        MvcResult result = send(c.route().method(), req.path(), req.token(), raw);
        assertOutcome(result, c.status(), c.message());
        if (before == null) return;
        Object after;
        try {
            after = snapshot(req);
        } catch (org.springframework.jdbc.UncategorizedSQLException aborted) {
            // The service caught a PostGIS error itself; inside the test's wrapping transaction that poisons the connection
            // (SQL state 25P02), so the probe cannot read. In production there is no wrapping transaction.
            if ("25P02".equals(aborted.getSQLException().getSQLState())) return;
            throw aborted;
        }
        if (c.status() == 409) return; // a duplicate-key insert aborts the test transaction; nothing more can be read
        if (c.status() >= 300) assertThat(after).as("a rejected request must change nothing").isEqualTo(before);
        else if (req.createsOnSuccess() && c.what().equals("valid request")) assertThat((Long) after).as("an accepted request must store a row").isEqualTo((Long) before + 1);
    }
}
