package vn.terrawatch.core.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import vn.terrawatch.core.security.FirebaseIdTokenVerifier;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Account lifecycle decision table (ST-USR-*): what an admin action does to an account in each state, which old tokens
 * survive, and what Google sign-in and the e-mailed reset code do for staff and not-yet-approved accounts.
 * Cases that older tests already assert (001, 004, 008-012, 019, 021, 026, 028, 032, 034-038, 046, 049, 051) are not repeated here.
 */
class AccountLifecycleApiTest extends FlowTestBase {

    @BeforeEach
    void mailConfigured() {
        when(mailer.configured()).thenReturn(true);
    }

    enum State { CITIZEN, PENDING_OFFICER, OFFICER, LOCKED, REJECTED_OFFICER, ADMIN }

    enum Act { APPROVE, REJECT, LOCK, UNLOCK, TO_CITIZEN, TO_OFFICER }

    /** An approved account that holds a token issued while it was healthy, then put into the given state. */
    private Acct inState(State state) {
        Acct a = switch (state) {
            case CITIZEN, LOCKED -> account("citizen");
            case ADMIN -> account("admin");
            default -> account("officer");
        };
        var u = a.user();
        switch (state) {
            case PENDING_OFFICER -> u.setApprovalStatus("pending");
            case REJECTED_OFFICER -> u.setApprovalStatus("rejected");
            case LOCKED -> u.setActive(false);
            default -> { }
        }
        users.saveAndFlush(u);
        return a;
    }

    private Map<String, Object> row(UUID id) {
        return jdbc.queryForMap("SELECT role::text AS role, is_active, approval_status FROM core_schema.users WHERE user_id = ?", id);
    }

    private long auditRows(UUID target, String action) {
        return count("SELECT count(*) FROM core_schema.admin_audit WHERE target_id = ? AND action = ?", target.toString(), action);
    }

    private org.springframework.test.web.servlet.ResultActions perform(Acct admin, UUID target, Act act) throws Exception {
        String base = "/api/v1/admin/users/" + target;
        return switch (act) {
            case APPROVE -> call(HttpMethod.POST, base + "/approve", admin, null);
            case REJECT -> call(HttpMethod.POST, base + "/reject", admin, null);
            case LOCK -> call(HttpMethod.PATCH, base + "/status", admin, Map.of("isActive", false));
            case UNLOCK -> call(HttpMethod.PATCH, base + "/status", admin, Map.of("isActive", true));
            case TO_CITIZEN -> call(HttpMethod.PATCH, base + "/role", admin, Map.of("role", "citizen"));
            case TO_OFFICER -> call(HttpMethod.PATCH, base + "/role", admin, Map.of("role", "officer"));
        };
    }

    private static String auditAction(Act act) {
        return switch (act) {
            case APPROVE -> "OFFICER_APPROVE";
            case REJECT -> "OFFICER_REJECT";
            case LOCK -> "USER_LOCK";
            case UNLOCK -> "USER_UNLOCK";
            case TO_CITIZEN, TO_OFFICER -> "USER_ROLE";
        };
    }

    // ---- admin event x account state: HTTP status, resulting row, audit row ----

    @ParameterizedTest(name = "{0} + admin {1} -> HTTP {2}; role={3} active={4} approval={5} [{6}]")
    @CsvSource({
        "CITIZEN,          APPROVE,    409, citizen, true,  approved, ST-USR-002",
        "CITIZEN,          REJECT,     409, citizen, true,  approved, ST-USR-003",
        "CITIZEN,          UNLOCK,     200, citizen, true,  approved, ST-USR-005",
        "PENDING_OFFICER,  LOCK,       200, officer, false, pending,  ST-USR-013",
        "PENDING_OFFICER,  UNLOCK,     200, officer, true,  pending,  ST-USR-014",
        "PENDING_OFFICER,  TO_CITIZEN, 200, citizen, true,  approved, ST-USR-015",
        "OFFICER,          APPROVE,    409, officer, true,  approved, ST-USR-020",
        "OFFICER,          LOCK,       200, officer, false, approved, ST-USR-022",
        "OFFICER,          UNLOCK,     200, officer, true,  approved, ST-USR-023",
        "OFFICER,          TO_CITIZEN, 200, citizen, true,  approved, ST-USR-024",
        "LOCKED,           APPROVE,    409, citizen, false, approved, ST-USR-029",
        "LOCKED,           REJECT,     409, citizen, false, approved, ST-USR-030",
        "LOCKED,           LOCK,       200, citizen, false, approved, ST-USR-031",
        "LOCKED,           TO_OFFICER, 200, officer, false, approved, ST-USR-033",
        "REJECTED_OFFICER, REJECT,     409, officer, true,  rejected, ST-USR-039",
        "REJECTED_OFFICER, LOCK,       200, officer, false, rejected, ST-USR-040",
        "REJECTED_OFFICER, UNLOCK,     200, officer, true,  rejected, ST-USR-041",
        "REJECTED_OFFICER, TO_CITIZEN, 200, citizen, true,  approved, ST-USR-042",
        "ADMIN,            APPROVE,    409, admin,   true,  approved, ST-USR-047",
        "ADMIN,            REJECT,     409, admin,   true,  approved, ST-USR-048",
        "ADMIN,            UNLOCK,     200, admin,   true,  approved, ST-USR-050"
    })
    void adminEventOnAccountState(State state, Act act, int httpStatus, String role, boolean active, String approval,
                                  String conditionId) throws Exception {
        // the acting admin is the target itself only in the ADMIN rows (an admin cannot approve/reject/unlock-test others there)
        Acct target = inState(state);
        Acct admin = state == State.ADMIN ? target : account("admin");

        perform(admin, target.id(), act).andExpect(status().is(httpStatus));

        Map<String, Object> after = row(target.id());
        assertThat(after.get("role")).isEqualTo(role);
        assertThat(after.get("is_active")).isEqualTo(active);
        assertThat(after.get("approval_status")).isEqualTo(approval);
        // a performed change leaves exactly one audit row; a refused one leaves none
        assertThat(auditRows(target.id(), auditAction(act))).isEqualTo(httpStatus == 200 ? 1 : 0);
    }

    // ---- ST-USR-016/052/007/025 (+043): a token issued before the state change ----

    @ParameterizedTest(name = "token from before, account now {0} -> GET /auth/me {1} [{2}]")
    @CsvSource({
        "CITIZEN,          200, ST-USR-007",
        "OFFICER,          200, ST-USR-025",
        "ADMIN,            200, ST-USR-052",
        "PENDING_OFFICER,  401, ST-USR-016",
        "REJECTED_OFFICER, 401, ST-USR-043"
    })
    void tokenIssuedBeforeTheCurrentState(State state, int httpStatus, String conditionId) throws Exception {
        Acct a = inState(state);

        call(HttpMethod.GET, "/api/v1/auth/me", a, null).andExpect(status().is(httpStatus));
    }

    @ParameterizedTest(name = "locked then unlocked {0}: old token works again")
    @CsvSource({"CITIZEN", "OFFICER"})
    void unlockingRestoresTheOldTokenWithoutANewLogin(State state) throws Exception {
        // ST-USR-022 + ST-USR-023: lock kills the token at once, unlock revives the same token
        Acct a = inState(state);
        Acct admin = account("admin");

        perform(admin, a.id(), Act.LOCK).andExpect(status().isOk());
        call(HttpMethod.GET, "/api/v1/auth/me", a, null).andExpect(status().isUnauthorized());
        perform(admin, a.id(), Act.UNLOCK).andExpect(status().isOk());
        call(HttpMethod.GET, "/api/v1/auth/me", a, null).andExpect(status().isOk());
    }

    @ParameterizedTest(name = "role change {0} -> {1}: the old token is judged by the new role")
    @CsvSource({
        "OFFICER, TO_CITIZEN, 403",   // ST-USR-024: officer token no longer opens the review queue
        "CITIZEN, TO_OFFICER, 200"    // ST-USR-006: same token opens it after promotion
    })
    void roleChangeAppliesToTheTokenAlreadyIssued(State state, Act act, int httpStatus) throws Exception {
        Acct a = inState(state);

        perform(account("admin"), a.id(), act).andExpect(status().isOk());

        call(HttpMethod.GET, "/api/v1/forecasts/review-queue", a, null).andExpect(status().is(httpStatus));
    }

    @ParameterizedTest(name = "pending officer promoted by role change ({0}) can now sign in")
    @CsvSource({"TO_CITIZEN, citizen", "TO_OFFICER, officer"})
    void roleChangeSettlesAPendingRequestSoLoginWorks(Act act, String role) throws Exception {
        // ST-USR-015: the pending request is settled as approved by an explicit role change
        Acct pending = inState(State.PENDING_OFFICER);
        call(HttpMethod.POST, "/api/v1/auth/login", null,
            Map.of("email", pending.user().getEmail(), "password", "secret123")).andExpect(status().isForbidden());

        perform(account("admin"), pending.id(), act).andExpect(status().isOk());

        assertThat(read(call(HttpMethod.POST, "/api/v1/auth/login", null,
            Map.of("email", pending.user().getEmail(), "password", "secret123")).andExpect(status().isOk())).get("role").asText())
            .isEqualTo(role);
    }

    // ---- Google sign-in: staff and not-approved accounts are refused, nothing is created ----

    @ParameterizedTest(name = "Google sign-in with the e-mail of a {0} account -> 403 [{1}]")
    @CsvSource({
        "PENDING_OFFICER,  ST-USR-017",
        "REJECTED_OFFICER, ST-USR-044",
        "ADMIN,            ST-USR-053"
    })
    void googleSignInIsRefusedForStaffAccounts(State state, String conditionId) throws Exception {
        Acct a = inState(state);
        when(verifier.verify("tok")).thenReturn(new FirebaseIdTokenVerifier.GoogleIdentity(a.user().getEmail(), "Someone"));
        long usersBefore = count("SELECT count(*) FROM core_schema.users");

        call(HttpMethod.POST, "/api/v1/auth/google", null, Map.of("idToken", "tok")).andExpect(status().isForbidden());

        assertThat(count("SELECT count(*) FROM core_schema.users")).isEqualTo(usersBefore);
        assertThat(row(a.id()).get("approval_status")).isEqualTo(a.user().getApprovalStatus());
    }

    // ---- e-mailed reset code: recorded behaviour for staff and not-approved accounts ----

    @ParameterizedTest(name = "reset code requested by a {0} account is e-mailed once [{1}]")
    @CsvSource({
        "PENDING_OFFICER,  ST-USR-018",
        "OFFICER,          ST-USR-027",
        "REJECTED_OFFICER, ST-USR-045",
        "ADMIN,            ST-USR-054"
    })
    void resetCodeIsMailedToEveryActiveEmailAccountRegardlessOfRoleOrApproval(State state, String conditionId) throws Exception {
        Acct a = inState(state);

        call(HttpMethod.POST, "/api/v1/auth/password-reset/email/request", null, Map.of("email", a.user().getEmail()))
            .andExpect(status().isOk());

        verify(mailer, times(1)).sendCode(eq(a.user().getEmail()), anyString(), org.mockito.ArgumentMatchers.matches("\\d{6}"), anyInt());
        assertThat(count("SELECT count(*) FROM core_schema.password_reset_codes WHERE user_id = ?", a.id())).isEqualTo(1);
    }
}
