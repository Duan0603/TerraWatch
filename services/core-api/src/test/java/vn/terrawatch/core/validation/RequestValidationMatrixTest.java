package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import vn.terrawatch.core.validation.Matrix.Case;
import vn.terrawatch.core.validation.Matrix.Cases;
import vn.terrawatch.core.validation.Matrix.Route;

import java.util.List;
import java.util.stream.Stream;

import static vn.terrawatch.core.validation.Matrix.a;
import static vn.terrawatch.core.validation.Matrix.drop;
import static vn.terrawatch.core.validation.Matrix.route;
import static vn.terrawatch.core.validation.Matrix.set;
import static vn.terrawatch.core.validation.ValidationTestBase.map;

/**
 * Request-body validation of the public /api/v1/auth routes (no token needed): register, officer request,
 * login, Google sign-in and the two password-reset flows. Each row is one HTTP call against a valid base payload
 * with exactly one thing changed; see {@link ValidationTestBase#run}.
 */
class RequestValidationMatrixTest extends ValidationTestBase {
    static final String USERS = "core_schema.users";
    static final String FAIL = "Mã xác nhận không đúng hoặc đã hết hạn";
    static final String OVER_72_BYTES = "Password exceeds 72 UTF-8 bytes";
    /** 36 x 'é' = 72 UTF-8 bytes (accepted), 37 x 'é' = 74 bytes (refused by the service, not by @Size). */
    static final String E36 = "é".repeat(36), E37 = "é".repeat(37);

    static final Route REGISTER = route("POST /api/v1/auth/register", 201, t -> t.creating("/api/v1/auth/register", null,
        map("fullName", "Nguyễn Văn A", "email", t.uniq("reg") + "@validation.example", "password", "secret123"), USERS));
    static final Route OFFICER = route("POST /api/v1/auth/officer-requests", 201, t -> t.creating("/api/v1/auth/officer-requests", null,
        map("fullName", "Trần Cán Bộ", "email", t.uniq("off") + "@validation.example", "password", "secret123",
            "phoneNumber", "0901234567", "phoneToken", "ok:0901234567", "departmentUnit", "Phòng PCTT"), USERS));
    static final Route LOGIN = route("POST /api/v1/auth/login", 200, t -> {
        Acct u = t.account("citizen", t.uniq("login"));
        return t.plain("/api/v1/auth/login", null, map("email", u.user().getEmail(), "password", "secret123"));
    });
    static final Route GOOGLE = route("POST /api/v1/auth/google", 200, t ->
        t.creating("/api/v1/auth/google", null, map("idToken", "good-token-" + t.uniq("g")), USERS));
    static final Route RESET_EMAIL_REQUEST = route("POST /api/v1/auth/password-reset/email/request", 200, t -> {
        Acct u = t.account("citizen", t.uniq("rer"));
        return t.plain("/api/v1/auth/password-reset/email/request", null, map("email", u.user().getEmail()));
    });
    static final Route RESET_EMAIL_VERIFY = route("POST /api/v1/auth/password-reset/email/verify", 200, t -> {
        Acct u = t.account("citizen", t.uniq("rev"));
        t.seedResetCode(u.id(), false);
        return t.probing("/api/v1/auth/password-reset/email/verify", null, map("email", u.user().getEmail(), "code", "123456"),
            () -> t.column("SELECT verified_at IS NOT NULL FROM core_schema.password_reset_codes WHERE user_id = ?", u.id()));
    });
    static final Route RESET_EMAIL_COMPLETE = route("POST /api/v1/auth/password-reset/email/complete", 204, t -> {
        Acct u = t.account("citizen", t.uniq("rec"));
        t.seedResetCode(u.id(), true);
        return t.probing("/api/v1/auth/password-reset/email/complete", null,
            map("email", u.user().getEmail(), "resetToken", "reset-token", "newPassword", "newsecret1"),
            () -> t.column("SELECT password_hash FROM core_schema.users WHERE user_id = ?", u.id()));
    });
    static final Route RESET_CHECK = route("POST /api/v1/auth/password-reset/check", 200, t -> {
        Acct u = t.account("citizen", t.uniq("chk"), "0901234567");
        return t.plain("/api/v1/auth/password-reset/check", null, map("email", u.user().getEmail(), "phoneNumber", "0901234567"));
    });
    static final Route RESET_PHONE = route("POST /api/v1/auth/password-reset", 204, t -> {
        Acct u = t.account("citizen", t.uniq("rph"), "0901234567");
        return t.probing("/api/v1/auth/password-reset", null,
            map("email", u.user().getEmail(), "phoneNumber", "0901234567", "phoneToken", "ok:0901234567", "newPassword", "newsecret1"),
            () -> t.column("SELECT password_hash FROM core_schema.users WHERE user_id = ?", u.id()));
    });

    static final List<Route> ROUTES = List.of(REGISTER, OFFICER, LOGIN, GOOGLE, RESET_EMAIL_REQUEST, RESET_EMAIL_VERIFY,
        RESET_EMAIL_COMPLETE, RESET_CHECK, RESET_PHONE);

    // ------------------------------------------------------------------ rows

    static Stream<Case> register() {
        return new Cases(REGISTER).envelope(400).ignoresIdentityFields()
            .required("fullName", "email", "password")
            .length("fullName", 1, 100).notText("fullName", "email", "password")
            .length("email", 1, 150, n -> emailOfLength(n))
            .oneOf("email", List.of("a@b.co", "user.name+tag@sub.example.org", "A@B.CO"),
                List.of("no-at-sign.example.com", "missing-domain@", "@missing-local.com", "two@@example.com", "spaces in@example.com", "trailing@example.com "))
            .ok("email without a dot in the domain (a@b) is valid for @Email", set("email", "a@b"))
            .length("password", 8, 72)
            .ok("password 72 bytes of 2-byte characters", set("password", E36))
            .message("password 74 bytes of 2-byte characters", 400, OVER_72_BYTES, set("password", E37))
            .bad("password of 8 spaces is blank", set("password", " ".repeat(8)))
            .ok("phone with a verified token", m -> { m.put("phoneNumber", "0901234567"); m.put("phoneToken", "ok:0901234567"); return m; })
            .ok("phone_number / phoneToken aliases", m -> { m.put("phone_number", "0901234567"); m.put("id_token", "ok:0901234567"); return m; })
            .ok("phone 20 chars with a verified token", m -> { m.put("phoneNumber", "0".repeat(20)); m.put("phoneToken", "ok:" + "0".repeat(20)); return m; })
            .bad("phone 21 chars", m -> { m.put("phoneNumber", "0".repeat(21)); m.put("phoneToken", "ok:" + "0".repeat(21)); return m; })
            .message("phone without a token", 400, "Phone number must be verified via OTP before registration", set("phoneNumber", "0901234567"))
            .message("phone with a token for another number", 400, "Phone number in verification token does not match registered phone number",
                m -> { m.put("phoneNumber", "0901234567"); m.put("phoneToken", "ok:0999999999"); return m; })
            .message("phone with a rejected token", 400, "Invalid phone token",
                m -> { m.put("phoneNumber", "0901234567"); m.put("phoneToken", "forged"); return m; })
            .ok("phone null", set("phoneNumber", null))
            .ok("phone empty string", set("phoneNumber", ""))
            .stream();
    }

    static Stream<Case> officerRequest() {
        return new Cases(OFFICER).envelope(400).ignoresIdentityFields()
            .required("fullName", "email", "password", "phoneNumber", "phoneToken", "departmentUnit")
            .length("fullName", 1, 100).length("departmentUnit", 1, 150).length("email", 1, 150, n -> emailOfLength(n))
            .length("password", 8, 72)
            .message("password 74 bytes of 2-byte characters", 400, OVER_72_BYTES, set("password", E37))
            .oneOf("email", List.of("officer@b.co"), List.of("no-at-sign", "x@", "@x.com"))
            .ok("phone 20 chars with a verified token", m -> { m.put("phoneNumber", "0".repeat(20)); m.put("phoneToken", "ok:" + "0".repeat(20)); return m; })
            .bad("phone 21 chars", m -> { m.put("phoneNumber", "0".repeat(21)); m.put("phoneToken", "ok:" + "0".repeat(21)); return m; })
            .ok("phone_number / phone_token / department_unit aliases", m -> {
                m.remove("phoneNumber"); m.remove("phoneToken"); m.remove("departmentUnit");
                m.put("phone_number", "0901234567"); m.put("phone_token", "ok:0901234567"); m.put("department_unit", "Phòng X"); return m; })
            .message("token for another number", 400, "Phone number in verification token does not match registered phone number", set("phoneToken", "ok:0999999999"))
            .message("forged token", 400, "Invalid phone token", set("phoneToken", "forged"))
            .notText("fullName", "departmentUnit", "phoneToken")
            .stream();
    }

    static Stream<Case> login() {
        return new Cases(LOGIN).envelope(400)
            .required("email", "password").notText("email", "password")
            .oneOf("email", List.of(), List.of("no-at-sign", "x@", "@x.com", "a b@c.com"))
            .message("email 150 chars passes validation, unknown account", 401, "Invalid credentials", set("email", emailOfLength(150)))
            .bad("email 151 chars", set("email", emailOfLength(151)))
            .message("password 1 char is not refused by length (no minimum on login)", 401, "Invalid credentials", set("password", "x"))
            .message("password 72 chars passes validation, wrong password", 401, "Invalid credentials", set("password", a(72)))
            .message("password 74 bytes of 2-byte characters", 400, OVER_72_BYTES, set("password", E37))
            .ok("email upper case and padded is normalised", m -> { m.put("email", m.get("email").toString().toUpperCase()); return m; })
            .stream();
    }

    static Stream<Case> google() {
        return new Cases(GOOGLE).envelope(400)
            .required("idToken").notText("idToken")
            .ok("idToken 4096 chars", set("idToken", "good-" + a(4096 - 5)))
            .bad("idToken 4097 chars", set("idToken", "good-" + a(4097 - 5)))
            .message("idToken the verifier rejects", 401, "Invalid Google token", set("idToken", "forged"))
            .stream();
    }

    static Stream<Case> emailResetRequest() {
        return new Cases(RESET_EMAIL_REQUEST).envelope(400)
            .required("email").notText("email")
            .ok("email 150 chars, unknown account answers the same", set("email", emailOfLength(150)))
            .bad("email 151 chars", set("email", emailOfLength(151)))
            .ok("email without @ answers the same (no @Email on this DTO)", set("email", "no-at-sign"))
            .stream();
    }

    static Stream<Case> emailResetVerify() {
        return new Cases(RESET_EMAIL_VERIFY).envelope(400)
            .required("email", "code").notText("email", "code")
            .message("email 150 chars passes validation, unknown account", 400, FAIL, set("email", emailOfLength(150)))
            .bad("email 151 chars", set("email", emailOfLength(151)))
            .message("code 12 chars is within the limit, wrong code", 400, FAIL, set("code", "1".repeat(12)))
            .bad("code 13 chars", set("code", "1".repeat(13)))
            .message("wrong 6-digit code", 400, FAIL, set("code", "000000"))
            .message("code with letters", 400, FAIL, set("code", "abcdef"))
            .ok("right code with padding is trimmed", set("code", " 123456 "))
            .stream();
    }

    static Stream<Case> emailResetComplete() {
        return new Cases(RESET_EMAIL_COMPLETE).envelope(400)
            .required("email", "resetToken", "newPassword").notText("email", "resetToken", "newPassword")
            .length("newPassword", 8, 72)
            .ok("newPassword 72 bytes of 2-byte characters", set("newPassword", E36))
            .message("newPassword 74 bytes of 2-byte characters", 400, OVER_72_BYTES, set("newPassword", E37))
            .message("resetToken length 200 (wrong token)", 400, FAIL, set("resetToken", a(200)))
            .bad("resetToken length 201", set("resetToken", a(201)))
            .message("wrong resetToken", 400, FAIL, set("resetToken", "not-the-token"))
            .message("email length 150 (unknown account)", 400, FAIL, set("email", emailOfLength(150)))
            .bad("email length 151", set("email", emailOfLength(151)))
            .stream();
    }

    static Stream<Case> resetCheck() {
        return new Cases(RESET_CHECK).envelope(400)
            .required("email", "phoneNumber").notText("email", "phoneNumber")
            .ok("phone 20 chars answers eligible=false", set("phoneNumber", "0".repeat(20)))
            .bad("phone 21 chars", set("phoneNumber", "0".repeat(21)))
            .ok("email 150 chars answers eligible=false", set("email", emailOfLength(150)))
            .bad("email 151 chars", set("email", emailOfLength(151)))
            .ok("phone_number alias", m -> { String p = m.remove("phoneNumber").toString(); m.put("phone_number", p); return m; })
            .stream();
    }

    static Stream<Case> resetPhone() {
        String mismatch = "Email hoặc số điện thoại không khớp với tài khoản nào";
        return new Cases(RESET_PHONE).envelope(400)
            .required("email", "phoneNumber", "phoneToken", "newPassword").notText("email", "phoneNumber", "phoneToken", "newPassword")
            .length("newPassword", 8, 72)
            .ok("newPassword 72 bytes of 2-byte characters", set("newPassword", E36))
            .message("newPassword 74 bytes of 2-byte characters", 400, OVER_72_BYTES, set("newPassword", E37))
            .message("phone 20 chars passes validation, no such account", 400, mismatch, m -> { m.put("phoneNumber", "0".repeat(20)); m.put("phoneToken", "ok:" + "0".repeat(20)); return m; })
            .bad("phone 21 chars", set("phoneNumber", "0".repeat(21)))
            .message("email 150 chars passes validation, no such account", 400, mismatch, set("email", emailOfLength(150)))
            .bad("email 151 chars", set("email", emailOfLength(151)))
            .message("token for another phone", 400, mismatch, set("phoneToken", "ok:0999999999"))
            .message("forged token", 400, "Invalid phone token", set("phoneToken", "forged"))
            .stream();
    }

    static Stream<Case> all() {
        return Stream.of(register(), officerRequest(), login(), google(), emailResetRequest(), emailResetVerify(), emailResetComplete(), resetCheck(), resetPhone()).flatMap(s -> s);
    }

    @DisplayName("public auth request bodies")
    @ParameterizedTest(name = "{0}")
    @MethodSource("all")
    void authBody(Case c) throws Exception {
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
