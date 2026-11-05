package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.dto.LoginRequest;
import vn.terrawatch.core.dto.RegisterRequest;
import vn.terrawatch.core.entity.User;
import vn.terrawatch.core.repository.UserRepository;
import vn.terrawatch.core.security.JwtTokenProvider;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class AuthControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired BCryptPasswordEncoder passwords;
    @Autowired JwtTokenProvider tokens;
    private static final String SECRET = "test-only-secret-at-least-thirty-two-bytes-long";

    @Test
    void registerLoginMeRoundTripForcesCitizenAndRejectsDuplicate() throws Exception {
        long before = users.count();
        JsonNode registered = body(postJson("/auth/register", Map.of("fullName", "Test Citizen",
            "email", "citizen@auth-test.example", "password", "secret123", "role", "admin",
            "phone_number", "0901234567"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("citizen"))
            .andExpect(jsonPath("$.user.phoneNumber").value("0901234567")));
        UUID id = UUID.fromString(registered.path("user").path("userId").asText());
        User saved = users.findById(id).orElseThrow();
        assertThat(saved.getRole()).isEqualTo("citizen");
        assertThat(passwords.matches("secret123", saved.getPasswordHash())).isTrue();
        assertThat(saved.getPasswordHash()).isNotEqualTo("secret123");
        postJson("/auth/register", Map.of("fullName", "Duplicate", "email", saved.getEmail(), "password", "secret123"))
            .andExpect(status().isConflict());
        assertThat(users.count()).isEqualTo(before + 1);
        JsonNode login = body(postJson("/auth/login", Map.of("email", saved.getEmail(), "password", "secret123"))
            .andExpect(status().isOk()));
        body(mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + login.path("token").asText()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(id.toString()))
            .andExpect(jsonPath("$.email").value(saved.getEmail())));
        assertThat(tokens.validateAndParse(login.path("token").asText()).getSubject()).isEqualTo(id.toString());
    }

    @Test
    void acceptsCamelCasePhoneAndIgnoresOfficerRole() throws Exception {
        body(postJson("/auth/register", Map.of("fullName", "Test", "email", "phone@auth-test.example",
            "password", "secret123", "phoneNumber", "0912345678", "role", "officer"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("citizen"))
            .andExpect(jsonPath("$.user.phoneNumber").value("0912345678")));
    }

    @Test
    void loginSupportsStoredHashesForEveryRoleAndReturnsIdenticalCredentialErrors() throws Exception {
        for (String role : new String[]{"citizen", "officer", "admin"}) {
            User user = users.saveAndFlush(new User("Test", role + "@auth-test.example",
                passwords.encode("secret123").replace("$2a$", "$2b$"), role, null));
            JsonNode login = body(postJson("/auth/login", Map.of("email", user.getEmail(), "password", "secret123"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role)));
            body(mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + login.path("token").asText()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role)));
        }
        JsonNode wrongPassword = body(postJson("/auth/login", Map.of("email", "citizen@auth-test.example", "password", "wrong"))
            .andExpect(status().isUnauthorized()));
        JsonNode unknownEmail = body(postJson("/auth/login", Map.of("email", "unknown@auth-test.example", "password", "wrong"))
            .andExpect(status().isUnauthorized()));
        assertThat(wrongPassword).isEqualTo(unknownEmail);
    }

    @Test
    void meRejectsMissingMalformedExpiredTamperedUnsignedAndIncompleteTokens() throws Exception {
        body(mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized()));
        User user = users.findByEmail("admin@terrawatch.vn").orElseThrow();
        String valid = tokens.generateToken(user);
        String expired = new JwtTokenProvider(SECRET, -60_000).generateToken(user);
        String wrongKey = new JwtTokenProvider(SECRET + "other", 60_000).generateToken(user);
        String missingClaims = Jwts.builder().subject(user.getUserId().toString())
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        String badSubject = Jwts.builder().subject("not-a-uuid").claim("role", "admin")
            .claim("email", user.getEmail()).expiration(new Date(System.currentTimeMillis() + 60_000))
            .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        String unsigned = Jwts.builder().subject(user.getUserId().toString()).compact();
        for (String header : new String[]{"Basic " + valid, "Bearer", "Bearer ", "Bearer garbage", "Bearer " + expired,
            "Bearer " + wrongKey, "Bearer " + unsigned, "Bearer " + missingClaims, "Bearer " + badSubject,
            "Bearer " + valid.substring(0, valid.lastIndexOf('.') + 1) + "AAAA"}) {
            body(mvc.perform(get("/api/v1/auth/me").header("Authorization", header)).andExpect(status().isUnauthorized()));
        }
        User missingUser = new User("Missing", "missing@example.com", "hash", "citizen", null);
        missingUser.setUserId(UUID.randomUUID());
        body(mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + tokens.generateToken(missingUser)))
            .andExpect(status().isUnauthorized()));
    }

    @Test
    void validatesRequestsWithoutEchoingPasswords() throws Exception {
        for (Map<String, String> request : java.util.List.<Map<String, String>>of(
            Map.of(), Map.of("fullName", "Test", "email", "bad-email", "password", "secret123"),
            Map.of("fullName", " ", "email", "test@example.com", "password", "secret123"),
            Map.of("fullName", "Test", "email", "test@example.com", "password", " "),
            Map.of("fullName", "Test", "email", "test@example.com", "password", "界".repeat(25)),
            Map.of("fullName", "x".repeat(101), "email", "test@example.com", "password", "secret123"),
            Map.of("fullName", "Test", "email", "test@example.com", "password", "secret123", "phoneNumber", "x".repeat(21))
        )) {
            body(postJson("/auth/register", request).andExpect(status().isBadRequest()));
        }
        body(postJson("/auth/login", Map.of()).andExpect(status().isBadRequest()));
        body(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"password\":\"secret123\"," )).andExpect(status().isBadRequest()));
    }

    @Test
    void existingRoutesAndDocsRemainPublicEvenWithGarbageBearer() throws Exception {
        for (String path : new String[]{"/landslides/queue", "/landslides/active", "/community-reports", "/monitoring-areas"}) {
            mvc.perform(get("/api/v1" + path)).andExpect(status().isOk());
            mvc.perform(get("/api/v1" + path).header("Authorization", "Bearer garbage")).andExpect(status().isOk());
        }
        mvc.perform(get("/api-docs")).andExpect(status().isOk());
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        mvc.perform(get("/swagger-ui.html")).andExpect(status().is3xxRedirection());
    }

    @Test
    void broadcastIsRestrictedToAdminRole() throws Exception {
        Map<String, String> alert = Map.of("eventId", "auth-regression", "riskLevel", "high",
            "message", "test", "targetArea", "test");

        postJson("/notifications/broadcast", alert).andExpect(status().isUnauthorized());

        for (String role : new String[]{"citizen", "officer"}) {
            User user = users.saveAndFlush(new User("Test", role + "-broadcast@auth-test.example",
                passwords.encode("secret123"), role, null));
            mvc.perform(post("/api/v1/notifications/broadcast").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(alert))
                .header("Authorization", "Bearer " + tokens.generateToken(user)))
                .andExpect(status().isForbidden());
        }

        User admin = users.findByEmail("admin@terrawatch.vn").orElseThrow();
        mvc.perform(post("/api/v1/notifications/broadcast").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(alert))
            .header("Authorization", "Bearer " + tokens.generateToken(admin)))
            .andExpect(status().isOk());
    }

    @Test
    void passwordFieldsAreNeverSerializedOrIncludedInRequestToString() throws Exception {
        User user = users.findByEmail("admin@terrawatch.vn").orElseThrow();
        assertThat(json.writeValueAsString(user)).doesNotContain("passwordHash", "password_hash", user.getPasswordHash());
        var register = new RegisterRequest("Test", "test@example.com", "secret123", null);
        var login = new LoginRequest("test@example.com", "secret123");
        assertThat(json.writeValueAsString(register)).doesNotContain("password", "secret123");
        assertThat(json.writeValueAsString(login)).doesNotContain("password", "secret123");
        assertThat(register.toString() + login.toString()).doesNotContain("secret123");
    }

    private ResultActions postJson(String path, Object request) throws Exception {
        return mvc.perform(post("/api/v1" + path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)));
    }

    private JsonNode body(ResultActions result) throws Exception {
        String content = result.andReturn().getResponse().getContentAsString();
        assertThat(content).doesNotContain("passwordHash", "password_hash", "\"password\"", "secret123", "$2a$", "$2b$");
        return json.readTree(content);
    }
}
