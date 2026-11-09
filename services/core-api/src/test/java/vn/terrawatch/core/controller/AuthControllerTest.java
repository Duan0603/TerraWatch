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

import org.springframework.boot.test.mock.mockito.MockBean;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class AuthControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired BCryptPasswordEncoder passwords;
    @Autowired JwtTokenProvider tokens;
    @MockBean FirebaseIdTokenVerifier verifier;
    private static final String SECRET = "test-only-secret-at-least-thirty-two-bytes-long";

    @org.junit.jupiter.api.BeforeEach
    void setUpMock() {
        when(verifier.verifyPhoneToken(anyString())).thenAnswer(inv -> {
            String tok = inv.getArgument(0);
            if ("valid-token".equals(tok)) return "+84901234567";
            if ("officer-token".equals(tok)) return "+84912345678";
            if ("mismatch-token".equals(tok)) return "+84999999999";
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid phone token");
        });
    }

    @Test
    void registerLoginMeRoundTripForcesCitizenAndRejectsDuplicate() throws Exception {
        long before = users.count();
        JsonNode registered = body(postJson("/auth/register", Map.of("fullName", "Test Citizen",
            "email", "citizen@auth-test.example", "password", "secret123", "role", "admin",
            "phone_number", "0901234567", "phoneToken", "valid-token"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("citizen"))
            .andExpect(jsonPath("$.user.phoneNumber").value("0901234567")));
        UUID id = UUID.fromString(registered.path("user").path("userId").asText());
        User saved = users.findById(id).orElseThrow();
        assertThat(saved.getRole()).isEqualTo("citizen");
        assertThat(passwords.matches("secret123", saved.getPasswordHash())).isTrue();
        assertThat(saved.getPasswordHash()).isNotEqualTo("secret123");
        postJson("/auth/register", Map.of("fullName", "Duplicate", "email", saved.getEmail(), "password", "secret123",
            "phoneToken", "valid-token", "phone_number", "0901234567"))
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
    void registerRequiresOtpForPhoneNumberAndRejectsMismatchOrMissingToken() throws Exception {
        // Có số điện thoại nhưng không gửi phoneToken (gọi API trực tiếp để bypass) -> 400
        postJson("/auth/register", Map.of("fullName", "Test", "email", "no-otp@auth-test.example",
            "password", "secret123", "phone_number", "0901234567"))
            .andExpect(status().isBadRequest());

        // Gửi token giả hoặc token hết hạn -> 400
        postJson("/auth/register", Map.of("fullName", "Test", "email", "bad-otp@auth-test.example",
            "password", "secret123", "phone_number", "0901234567", "phoneToken", "fake-token"))
            .andExpect(status().isBadRequest());

        // Token hợp lệ nhưng thuộc về số điện thoại khác -> 400
        postJson("/auth/register", Map.of("fullName", "Test", "email", "mismatch@auth-test.example",
            "password", "secret123", "phone_number", "0901234567", "phoneToken", "mismatch-token"))
            .andExpect(status().isBadRequest());

        // Token hợp lệ và khớp số điện thoại (+84901234567 khớp 0901234567) -> 201
        postJson("/auth/register", Map.of("fullName", "Test", "email", "success-otp@auth-test.example",
            "password", "secret123", "phone_number", "0901234567", "phoneToken", "valid-token"))
            .andExpect(status().isCreated());
    }

    @Test
    void forgotPasswordNeedsTheRegisteredPhoneAndItsOtp() throws Exception {
        users.saveAndFlush(new User("Forgetful", "forgot@auth-test.example", passwords.encode("old-secret1"), "citizen", "0901234567"));
        users.saveAndFlush(new User("No Phone", "nophone@auth-test.example", passwords.encode("old-secret1"), "citizen", null));
        User locked = new User("Locked", "locked-reset@auth-test.example", passwords.encode("old-secret1"), "citizen", "0901234567");
        locked.setActive(false);
        users.saveAndFlush(locked);

        // The pre-check only says yes for the right email + registered phone (no SMS is wasted otherwise).
        postJson("/auth/password-reset/check", Map.of("email", "Forgot@Auth-Test.Example", "phoneNumber", "+84901234567"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.eligible").value(true));
        for (Map<String, String> no : java.util.List.of(
            Map.of("email", "forgot@auth-test.example", "phoneNumber", "0912345678"),
            Map.of("email", "nobody@auth-test.example", "phoneNumber", "0901234567"),
            Map.of("email", "nophone@auth-test.example", "phoneNumber", "0901234567"),
            Map.of("email", "locked-reset@auth-test.example", "phoneNumber", "0901234567"))) {
            postJson("/auth/password-reset/check", no).andExpect(jsonPath("$.eligible").value(false));
        }

        Map<String, String> reset = new java.util.HashMap<>(Map.of("email", "forgot@auth-test.example",
            "phoneNumber", "0901234567", "newPassword", "brand-new-pw1"));
        // No / wrong-owner / invalid token, short password, unknown or locked account: all the same 400.
        postJson("/auth/password-reset", reset).andExpect(status().isBadRequest());
        for (String token : new String[]{"mismatch-token", "fake-token"}) {
            Map<String, String> bad = new java.util.HashMap<>(reset);
            bad.put("phoneToken", token);
            postJson("/auth/password-reset", bad).andExpect(status().isBadRequest());
        }
        Map<String, String> shortPw = new java.util.HashMap<>(reset);
        shortPw.put("phoneToken", "valid-token");
        shortPw.put("newPassword", "short");
        postJson("/auth/password-reset", shortPw).andExpect(status().isBadRequest());
        Map<String, String> lockedReq = new java.util.HashMap<>(reset);
        lockedReq.put("phoneToken", "valid-token");
        lockedReq.put("email", "locked-reset@auth-test.example");
        postJson("/auth/password-reset", lockedReq).andExpect(status().isBadRequest());
        postJson("/auth/login", Map.of("email", "forgot@auth-test.example", "password", "old-secret1")).andExpect(status().isOk());

        // The right phone token sets the new password; the old one stops working.
        Map<String, String> ok = new java.util.HashMap<>(reset);
        ok.put("phoneToken", "valid-token");
        postJson("/auth/password-reset", ok).andExpect(status().isNoContent());
        postJson("/auth/login", Map.of("email", "forgot@auth-test.example", "password", "brand-new-pw1")).andExpect(status().isOk());
        postJson("/auth/login", Map.of("email", "forgot@auth-test.example", "password", "old-secret1")).andExpect(status().isUnauthorized());
    }

    @Test
    void emailExistsIsPublicAndNormalisesTheEmail() throws Exception {
        mvc.perform(get("/api/v1/auth/email-exists").param("email", "Nobody-Here@Auth-Test.Example"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.exists").value(false));
        users.saveAndFlush(new User("Test", "taken@auth-test.example", passwords.encode("secret123"), "citizen", null));
        mvc.perform(get("/api/v1/auth/email-exists").param("email", " Taken@Auth-Test.Example "))
            .andExpect(status().isOk()).andExpect(jsonPath("$.exists").value(true));
        mvc.perform(get("/api/v1/auth/email-exists").param("email", " ")).andExpect(jsonPath("$.exists").value(false));
    }

    @Test
    void officerRequestNeedsVerifiedPhoneAndStaysPendingUntilApproved() throws Exception {
        Map<String, String> base = Map.of("fullName", "Cán bộ Mới", "email", "new-officer@auth-test.example",
            "password", "secret123", "phoneNumber", "0912345678", "departmentUnit", "Chi cục PCTT Yên Bái");

        // Missing OTP token, missing unit or a token for another number are refused.
        postJson("/auth/officer-requests", base).andExpect(status().isBadRequest());
        Map<String, String> noUnit = new java.util.HashMap<>(base);
        noUnit.put("phoneToken", "officer-token");
        noUnit.remove("departmentUnit");
        postJson("/auth/officer-requests", noUnit).andExpect(status().isBadRequest());
        Map<String, String> wrongPhone = new java.util.HashMap<>(base);
        wrongPhone.put("phoneToken", "valid-token");
        postJson("/auth/officer-requests", wrongPhone).andExpect(status().isBadRequest());

        Map<String, String> ok = new java.util.HashMap<>(base);
        ok.put("phoneToken", "officer-token");
        JsonNode created = body(postJson("/auth/officer-requests", ok).andExpect(status().isCreated())
            .andExpect(jsonPath("$.approvalStatus").value("pending")).andExpect(jsonPath("$.token").doesNotExist()));
        assertThat(created.path("requestId").asText()).isNotBlank();

        User saved = users.findByEmail("new-officer@auth-test.example").orElseThrow();
        assertThat(saved.getRole()).isEqualTo("officer");
        assertThat(saved.getApprovalStatus()).isEqualTo("pending");
        assertThat(saved.getDepartmentUnit()).isEqualTo("Chi cục PCTT Yên Bái");

        // No sign-in and no API access until an admin approves.
        postJson("/auth/login", Map.of("email", "new-officer@auth-test.example", "password", "secret123"))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/forecasts/queue").header("Authorization", "Bearer " + tokens.generateToken(saved)))
            .andExpect(status().isUnauthorized());

        // The same email cannot be requested twice.
        postJson("/auth/officer-requests", ok).andExpect(status().isConflict());
    }

    @Test
    void acceptsCamelCasePhoneAndIgnoresOfficerRole() throws Exception {
        body(postJson("/auth/register", Map.of("fullName", "Test", "email", "phone@auth-test.example",
            "password", "secret123", "phoneNumber", "0912345678", "role", "officer", "phoneToken", "officer-token"))
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
        for (String path : new String[]{"/landslides/active", "/monitoring-areas"}) {
            mvc.perform(get("/api/v1" + path)).andExpect(status().isOk());
            mvc.perform(get("/api/v1" + path).header("Authorization", "Bearer garbage")).andExpect(status().isOk());
        }
        mvc.perform(get("/api-docs")).andExpect(status().isOk());
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        mvc.perform(get("/swagger-ui.html")).andExpect(status().is3xxRedirection());
    }

    @Test
    void legacyIncidentReviewAndDiagnosticsAreStaffOnly() throws Exception {
        String verify = "/api/v1/landslides/00000000-0000-0000-0000-000000000000/verify";
        String patch = "{\"status\":\"rejected\"}";
        // Anonymous: 401. Citizen: 403. (Before Story 4.23 anyone could approve or reject an incident.)
        mvc.perform(get("/api/v1/landslides/queue")).andExpect(status().isUnauthorized());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(verify)
            .contentType(MediaType.APPLICATION_JSON).content(patch)).andExpect(status().isUnauthorized());
        User citizen = users.saveAndFlush(new User("Test", "citizen-incident@auth-test.example", passwords.encode("secret123"), "citizen", null));
        String citizenToken = "Bearer " + tokens.generateToken(citizen);
        mvc.perform(get("/api/v1/landslides/queue").header("Authorization", citizenToken)).andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(verify).header("Authorization", citizenToken)
            .contentType(MediaType.APPLICATION_JSON).content(patch)).andExpect(status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/diagnostic/event-bus/publish")
            .header("Authorization", citizenToken)).andExpect(status().isForbidden());

        // Bad input from an officer is a clear 4xx, never a 500.
        String officerToken = "Bearer " + tokens.generateToken(users.saveAndFlush(
            new User("Test", "officer-bad-input@auth-test.example", passwords.encode("secret123"), "officer", null)));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(verify).header("Authorization", officerToken)
            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"rejected\"}")).andExpect(status().isNotFound());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(verify).header("Authorization", officerToken)
            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"banana\"}")).andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/landslides/not-a-uuid/verify")
            .header("Authorization", officerToken).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"rejected\"}"))
            .andExpect(status().isBadRequest());

        // An officer reaches the queue.
        User officer = users.saveAndFlush(new User("Test", "officer-incident@auth-test.example", passwords.encode("secret123"), "officer", null));
        mvc.perform(get("/api/v1/landslides/queue").header("Authorization", "Bearer " + tokens.generateToken(officer)))
            .andExpect(status().isOk());
    }

    @Test
    void fullCommunityReportListNeedsStaffRoleBecauseItCarriesPhonesAndGps() throws Exception {
        mvc.perform(get("/api/v1/community-reports")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/community-reports").header("Authorization", "Bearer garbage"))
            .andExpect(status().isUnauthorized());
        User citizen = users.saveAndFlush(new User("Test", "citizen-reports@auth-test.example",
            passwords.encode("secret123"), "citizen", null));
        mvc.perform(get("/api/v1/community-reports").header("Authorization", "Bearer " + tokens.generateToken(citizen)))
            .andExpect(status().isForbidden());
        User officer = users.saveAndFlush(new User("Test", "officer-reports@auth-test.example",
            passwords.encode("secret123"), "officer", null));
        mvc.perform(get("/api/v1/community-reports").header("Authorization", "Bearer " + tokens.generateToken(officer)))
            .andExpect(status().isOk());
    }

    @Test
    void oldTokenStopsWorkingWhenTheAccountIsLockedOrDemoted() throws Exception {
        User admin = users.saveAndFlush(new User("Test", "admin-stale@auth-test.example",
            passwords.encode("secret123"), "admin", null));
        String token = tokens.generateToken(admin);
        mvc.perform(get("/api/v1/admin/users").header("Authorization", "Bearer " + token)).andExpect(status().isOk());

        admin.setRole("citizen");
        users.saveAndFlush(admin);
        mvc.perform(get("/api/v1/admin/users").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());

        admin.setActive(false);
        users.saveAndFlush(admin);
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
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
        var register = new RegisterRequest("Test", "test@example.com", "secret123", null, null);
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
