package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pairwise table of signing in (PW-AUTH-001..011): channel x method x role x account state x credentials.
 * What the server decides, per row: wrong credentials are a 401 with one generic message whatever the role and state (so a
 * locked or pending account cannot be told apart by a guess); correct credentials on a locked account are 403 "tạm khóa",
 * on a pending or rejected one 403 "chờ phê duyệt"; Google sign-in of a staff account is 403 "only citizen" before the state is
 * looked at; every refusal carries no token.
 * "Channel" is not a server input: web and phone send the same request. "Mobile only takes citizens" is the app's rule
 * (BR-07, auth_repository.dart): for the server a correct officer or admin login from "mobile" is a normal 200 (PW-AUTH-006).
 * The channel column is therefore recorded as not automatable at API level, the other four columns are asserted.
 */
class LoginPairwiseApiTest extends FlowTestBase {

    @ParameterizedTest(name = "{0}: {1} via {2}, {3} account, {4}, credentials {5} -> {6}")
    @CsvSource({
        "PW-AUTH-001, web,    password, citizen, active,  correct, 200",
        "PW-AUTH-002, web,    google,   officer, locked,  wrong,   401",
        "PW-AUTH-003, mobile, password, admin,   pending, wrong,   401",
        "PW-AUTH-004, mobile, google,   citizen, locked,  correct, 403",
        "PW-AUTH-005, web,    google,   admin,   pending, correct, 403",
        "PW-AUTH-006, mobile, password, officer, active,  correct, 200",
        "PW-AUTH-007, web,    google,   citizen, active,  wrong,   401",
        "PW-AUTH-008, web,    password, admin,   locked,  correct, 403",
        "PW-AUTH-009, web,    password, citizen, pending, correct, 403",
        "PW-AUTH-010, web,    password, officer, pending, correct, 403",
        "PW-AUTH-011, web,    password, admin,   active,  correct, 200"
    })
    void signInCombinationIsDecidedByMethodRoleStateAndCredentials(String id, String channel, String method, String role, String state,
                                                                  String credentials, int expected) throws Exception {
        Acct a = account(role);
        var user = a.user();
        if (state.equals("locked")) user.setActive(false);
        if (state.equals("pending")) user.setApprovalStatus("pending");
        users.saveAndFlush(user);
        long usersBefore = count("SELECT count(*) FROM core_schema.users");
        boolean correct = credentials.equals("correct");

        var result = method.equals("password")
            ? call(HttpMethod.POST, "/api/v1/auth/login", null,
                Map.of("email", a.user().getEmail(), "password", correct ? "secret123" : "not-the-password"))
            : google(a.user().getEmail(), correct);
        result.andExpect(status().is(expected));

        JsonNode body = read(result);
        assertThat(count("SELECT count(*) FROM core_schema.users")).as("sign-in never creates or removes an account").isEqualTo(usersBefore);
        if (expected == 200) {
            assertThat(body.get("role").asText()).isEqualTo(role);
            String token = body.get("token").asText();
            // the token is a real session: it opens the profile of this account
            call(HttpMethod.GET, "/api/v1/auth/me", new Acct(a.user(), token), null).andExpect(status().isOk());
        } else {
            assertThat(body.has("token")).as("a refusal carries no token").isFalse();
            String message = body.get("message").asText();
            if (!correct) {
                assertThat(message).isIn("Invalid credentials", "Invalid Google sign-in");
            } else if (method.equals("google") && !role.equals("citizen")) {
                assertThat(message).contains("only available for citizen accounts");
            } else if (state.equals("locked")) {
                assertThat(message).contains("tạm khóa");
            } else {
                assertThat(message).contains("chờ Quản trị viên phê duyệt");
            }
        }
    }

    private org.springframework.test.web.servlet.ResultActions google(String email, boolean correct) throws Exception {
        if (correct) when(verifier.verify("pw-google")).thenReturn(new FirebaseIdTokenVerifier.GoogleIdentity(email, "Pairwise"));
        else when(verifier.verify("pw-google")).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid Google sign-in"));
        return call(HttpMethod.POST, "/api/v1/auth/google", null, Map.of("idToken", "pw-google"));
    }
}
