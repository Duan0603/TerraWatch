package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.JwtTokenProvider;
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import vn.terrawatch.core.service.LiveUpdateHub;
import vn.terrawatch.core.service.PasswordResetMailer;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;


/**
 * Plumbing for the controller flow tests: one Spring context (senders, live hub and Redis publisher mocked),
 * accounts with real JWTs per role, and every test rolled back so no rows survive.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
abstract class FlowTestBase {
    static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    /** 8 bytes that start with the JPEG signature. */
    static final String JPEG = java.util.Base64.getEncoder().encodeToString(
        new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 1, 2, 3});
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
    // The same mocked beans as validation.ValidationTestBase, so every API test shares one cached Spring context
    // (each extra context holds a connection pool and the test database runs out of connections).
    @MockBean FirebaseIdTokenVerifier verifier;
    @MockBean PasswordResetMailer mailer;
    @MockBean AiServiceClient ai;
    @MockBean EventPublisher events;
    @Autowired LiveUpdateHub hub;

    @BeforeEach
    void stubSenders() {
        when(fcm.send(anyString(), any())).thenReturn(FcmSender.Result.sent());
        when(sms.send(anyString(), anyString())).thenReturn(SmsSender.Result.sent("MOCK_SID"));
    }

    record Acct(User user, String token) {
        UUID id() { return user.getUserId(); }
    }

    /** Password of every account is "secret123". */
    Acct account(String role, String fullName, String phone) {
        if (passwordHash == null) passwordHash = encoder.encode("secret123");
        String email = UUID.randomUUID().toString().substring(0, 8) + "@flow.example";
        User user = users.saveAndFlush(new User(fullName, email, passwordHash, role, phone));
        return new Acct(user, tokens.generateToken(user));
    }

    Acct account(String role) { return account(role, "Flow " + role, null); }

    /** Performs the request, then flushes JPA so the plain-SQL reads and the SQL-based services see what the service saved. */
    ResultActions call(HttpMethod method, String path, Acct as, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (as != null) builder.header("Authorization", "Bearer " + as.token());
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        ResultActions result = mvc.perform(builder);
        em.flush();
        return result;
    }

    JsonNode read(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    /** An open live-update stream of a staff member; {@link #updates} lists what was published since. */
    MvcResult openStream() throws Exception {
        return mvc.perform(get("/api/v1/stream").header("Authorization", "Bearer " + account("officer").token()))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.request().asyncStarted()).andReturn();
    }

    /** The "type" of every update event the stream received, in order. */
    java.util.List<String> updates(MvcResult stream) throws Exception {
        java.util.List<String> types = new java.util.ArrayList<>();
        var m = java.util.regex.Pattern.compile("event:update\\s*data:\\{\"type\":\"([a-z_]+)\"\\}")
            .matcher(stream.getResponse().getContentAsString());
        while (m.find()) types.add(m.group(1));
        return types;
    }

    int seedArea(String name, boolean active) {
        return jdbc.queryForObject("""
            INSERT INTO gis_schema.monitoring_areas (name, description, is_active, geom)
            VALUES (?, 'seed', ?, ST_Multi(ST_GeomFromText('POLYGON((105 21, 105.1 21, 105.1 21.1, 105 21.1, 105 21))', 4326)))
            RETURNING area_id
            """, Integer.class, name + "-" + UUID.randomUUID(), active);
    }

    int seedArea() { return seedArea("flow-area", true); }

    /** A push token for the user and an active subscription of the user to the area (push on, sms as given). */
    void subscribe(Acct user, int areaId, String fcmToken, boolean smsChannel) {
        jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES (?, ?)", fcmToken, user.id());
        jdbc.update("INSERT INTO core_schema.alert_subscriptions (user_id, area_id, channel_push, channel_sms) VALUES (?, ?, true, ?)",
            user.id(), areaId, smsChannel);
    }

    long count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Long.class, args);
    }
}
