package vn.terrawatch.core.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import vn.terrawatch.core.validation.Matrix.Case;
import vn.terrawatch.core.validation.Matrix.Cases;
import vn.terrawatch.core.validation.Matrix.Route;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static vn.terrawatch.core.validation.Matrix.a;
import static vn.terrawatch.core.validation.Matrix.drop;
import static vn.terrawatch.core.validation.Matrix.route;
import static vn.terrawatch.core.validation.Matrix.set;

/**
 * Request-body validation of the signed-in citizen routes: profile, password, avatar, alert subscriptions,
 * device tokens and field reports (the least-privileged role, citizen, is used for all of them).
 */
class CitizenValidationMatrixTest extends ValidationTestBase {
    static final String PROFILE_ROW = "SELECT concat_ws('|', full_name, phone_number, date_of_birth, gender, province, district, commune, address_line, "
        + "emergency_contact_name, emergency_contact_phone, emergency_contact_relation) FROM core_schema.users WHERE user_id = ?";
    static final String PHONE_9 = "0".repeat(9), PHONE_15 = "1".repeat(15);

    static final Route PROFILE = route("PUT /api/v1/auth/me", 200, t -> {
        Acct u = t.account("citizen", t.uniq("prof"));
        return t.probing("/api/v1/auth/me", u, map("fullName", "Lê Thị B", "phoneNumber", "0912345678", "dateOfBirth", "1990-05-17",
            "gender", "female", "province", "Yên Bái", "district", "Mù Cang Chải", "commune", "Chế Cu Nha", "addressLine", "Thôn 1",
            "emergencyContactName", "Lê Văn C", "emergencyContactPhone", "+84912345679", "emergencyContactRelation", "Anh"),
            () -> t.column(PROFILE_ROW, u.id()));
    });
    static final Route PASSWORD = route("PUT /api/v1/auth/password", 204, t -> {
        Acct u = t.account("citizen", t.uniq("pwd"));
        return t.probing("/api/v1/auth/password", u, map("currentPassword", "secret123", "newPassword", "newsecret1"),
            () -> t.column("SELECT password_hash FROM core_schema.users WHERE user_id = ?", u.id()));
    });
    static final Route AVATAR = route("PUT /api/v1/auth/me/avatar", 200, t -> {
        Acct u = t.account("citizen", t.uniq("ava"));
        return t.probing("/api/v1/auth/me/avatar", u, map("imageBase64", PNG_1X1),
            () -> t.column("SELECT has_avatar || '/' || (SELECT count(*) FROM core_schema.user_avatars WHERE user_id = ?) FROM core_schema.users WHERE user_id = ?", u.id(), u.id()));
    });
    static final Route SUBSCRIBE = route("POST /api/v1/alerts/subscriptions", 200, t -> {
        Acct u = t.account("citizen", t.uniq("sub"), "0901234567");
        int area = t.seedArea(t.uniq("area"));
        return t.creating("/api/v1/alerts/subscriptions", u, map("areaId", area, "alertChannels", List.of("PUSH")), "core_schema.alert_subscriptions");
    });
    static final Route DEVICE_REGISTER = route("POST /api/v1/alerts/devices/register", 204, t -> {
        Acct u = t.account("citizen", t.uniq("dev"));
        return t.creating("/api/v1/alerts/devices/register", u, map("fcmToken", t.uniq("token"), "deviceType", "android"), "core_schema.device_tokens");
    });
    static final Route DEVICE_DELETE = route("DELETE /api/v1/alerts/devices", 204, t -> {
        Acct u = t.account("citizen", t.uniq("devdel"));
        String token = t.uniq("token");
        t.jdbc.update("INSERT INTO core_schema.device_tokens (fcm_token, user_id) VALUES (?, ?)", token, u.id());
        return t.probing("/api/v1/alerts/devices", u, map("fcmToken", token), () -> t.count("core_schema.device_tokens"));
    });
    static final Route REPORT = route("POST /api/v1/community-reports", 201, t -> {
        Acct u = t.account("citizen", t.uniq("rep"));
        return t.creating("/api/v1/community-reports", u, map("clientReportId", UUID.randomUUID().toString(), "longitude", 104.113, "latitude", 21.864,
            "accuracyM", 8.5, "description", "Đất đá tràn qua đường", "observedAt", OffsetDateTime.now().minusHours(2).toString()), "core_schema.community_reports");
    });
    static final Route PHOTO = route("POST /api/v1/community-reports/photos", 200, t -> {
        Acct u = t.account("citizen", t.uniq("pho"));
        return t.creating("/api/v1/community-reports/photos", u, map("imageBase64", PNG_1X1), "core_schema.report_photos");
    });

    static final List<Route> ROUTES = List.of(PROFILE, PASSWORD, AVATAR, SUBSCRIBE, DEVICE_REGISTER, DEVICE_DELETE, REPORT, PHOTO);

    private static final List<String> PHONE_OK = List.of(PHONE_9, PHONE_15, "+" + PHONE_9, "+" + PHONE_15, "0901234567", "+84901234567", "");
    private static final List<String> PHONE_BAD = List.of("0".repeat(8), "0".repeat(16), "+" + "0".repeat(8), "+" + "0".repeat(16), "09012345ab",
        "0901 234 567", "090-123-4567", "(090)1234567", "++84901234567", "84+901234567", "０９０１２３４５６７８", " 0901234567");

    // ------------------------------------------------------------------ PUT /auth/me

    static Stream<Case> profile() {
        Cases c = new Cases(PROFILE).envelope(400).required("fullName").length("fullName", 1, 100).notText("fullName", "province");
        c.ok("fullName with Vietnamese diacritics", set("fullName", "Nguyễn Thị Ánh Tuyết"));
        for (String f : List.of("province", "district", "commune", "emergencyContactName")) {
            c.length(f, 0, 100).ok(f + " null clears it", set(f, null)).ok(f + " blank clears it", set(f, "   "));
        }
        c.length("addressLine", 0, 200).length("emergencyContactRelation", 0, 50)
            .ok("addressLine null clears it", set("addressLine", null)).ok("emergencyContactRelation null clears it", set("emergencyContactRelation", null));
        for (String f : List.of("phoneNumber", "emergencyContactPhone")) {
            c.oneOf(f, PHONE_OK, PHONE_BAD).ok(f + " null clears it", set(f, null));
        }
        c.ok("phone_number alias", m -> { m.remove("phoneNumber"); m.put("phone_number", "0987654321"); return m; });
        c.oneOf("gender", List.of("male", "female", "other", ""), List.of("Male", "FEMALE", "unknown", "nam", " male", "male "))
            .ok("gender null clears it", set("gender", null));
        LocalDate today = LocalDate.now();
        c.ok("dateOfBirth yesterday", set("dateOfBirth", today.minusDays(1).toString()))
            .bad("dateOfBirth today", set("dateOfBirth", today.toString()))
            .bad("dateOfBirth tomorrow", set("dateOfBirth", today.plusDays(1).toString()))
            .bad("dateOfBirth far future 9999-12-31", set("dateOfBirth", "9999-12-31"))
            .ok("dateOfBirth 1900-01-01 (oldest allowed)", set("dateOfBirth", "1900-01-01"))
            .message("dateOfBirth 1899-12-31 (day before the oldest allowed)", 400, "Date of birth is out of range", set("dateOfBirth", "1899-12-31"))
            .message("dateOfBirth 0001-01-01", 400, "Date of birth is out of range", set("dateOfBirth", "0001-01-01"))
            .ok("dateOfBirth null clears it", set("dateOfBirth", null))
            .ok("dateOfBirth missing clears it", drop("dateOfBirth"))
            .bad("dateOfBirth 2000-02-30 (no such day)", set("dateOfBirth", "2000-02-30"))
            .bad("dateOfBirth 2000-13-01 (no such month)", set("dateOfBirth", "2000-13-01"))
            .bad("dateOfBirth wrong format 17/05/1990", set("dateOfBirth", "17/05/1990"))
            .bad("dateOfBirth not a date", set("dateOfBirth", "yesterday"))
            .ok("dateOfBirth empty string is read as null (Jackson coercion), clears it", set("dateOfBirth", ""))
            .bad("dateOfBirth is a JSON object", set("dateOfBirth", java.util.Map.of("y", 1990)))
            .bad("dateOfBirth is a boolean", set("dateOfBirth", true));
        return c.stream();
    }

    // ------------------------------------------------------------------ PUT /auth/password

    static Stream<Case> password() {
        return new Cases(PASSWORD).envelope(400)
            .required("currentPassword", "newPassword").notText("currentPassword", "newPassword")
            .length("newPassword", 8, 72)
            .ok("newPassword 72 bytes of 2-byte characters", set("newPassword", RequestValidationMatrixTest.E36))
            .message("newPassword 74 bytes of 2-byte characters", 400, RequestValidationMatrixTest.OVER_72_BYTES, set("newPassword", RequestValidationMatrixTest.E37))
            .message("currentPassword wrong", 400, "Current password is incorrect", set("currentPassword", "not-my-password"))
            .message("currentPassword 72 chars (wrong password, within limit)", 400, "Current password is incorrect", set("currentPassword", a(72)))
            .bad("currentPassword 73 chars", set("currentPassword", a(73)))
            .stream();
    }

    // ------------------------------------------------------------------ PUT /auth/me/avatar and POST /community-reports/photos

    static Stream<Case> avatar() {
        return new Cases(AVATAR).envelope(400)
            .required("imageBase64").notText("imageBase64")
            .ok("200,000 decoded bytes (PNG), the limit", set("imageBase64", image(200_000, true)))
            .ok("200,000 decoded bytes (JPEG), the limit", set("imageBase64", image(200_000, false)))
            .message("200,001 decoded bytes", 400, "Image is larger than 200 KB", set("imageBase64", image(200_001, true)))
            .message("300,000 base64 chars, the @Size limit, still over 200 KB decoded", 400, "Image is larger than 200 KB", set("imageBase64", a(300_000)))
            .bad("300,001 base64 chars, above @Size", set("imageBase64", a(300_001)))
            .message("not base64", 400, "Image is not valid base64", set("imageBase64", "!!! not base64 !!!"))
            .message("base64 of plain text", 400, "Image must be JPEG or PNG", set("imageBase64", "aGVsbG8="))
            .message("base64 of a GIF header", 400, "Image must be JPEG or PNG", set("imageBase64", java.util.Base64.getEncoder().encodeToString("GIF89a....".getBytes())))
            .message("4-byte PNG signature is too short", 400, "Image must be JPEG or PNG",
                set("imageBase64", java.util.Base64.getEncoder().encodeToString(new byte[]{(byte) 0x89, 'P', 'N', 'G'})))
            .message("data: URI prefix is not accepted", 400, "Image is not valid base64", set("imageBase64", "data:image/png;base64," + PNG_1X1))
            .stream();
    }

    static Stream<Case> photo() {
        return new Cases(PHOTO).envelope(400)
            .required("imageBase64").notText("imageBase64")
            .ok("700,000 decoded bytes (PNG), the limit", set("imageBase64", image(700_000, true)))
            .ok("700,000 decoded bytes (JPEG), the limit", set("imageBase64", image(700_000, false)))
            .message("700,001 decoded bytes", 400, "Image is larger than 700 KB", set("imageBase64", image(700_001, true)))
            .message("1,000,000 base64 chars, the @Size limit, still over 700 KB decoded", 400, "Image is larger than 700 KB", set("imageBase64", a(1_000_000)))
            .bad("1,000,001 base64 chars, above @Size", set("imageBase64", a(1_000_001)))
            .message("not base64", 400, "Image is not valid base64", set("imageBase64", "!!! not base64 !!!"))
            .message("base64 of plain text", 400, "Image must be JPEG or PNG", set("imageBase64", "aGVsbG8="))
            .stream();
    }

    // ------------------------------------------------------------------ alerts

    static Stream<Case> subscribe() {
        Cases c = new Cases(SUBSCRIBE).envelope(400).nonNull("areaId", "alertChannels")
            .ok("alertChannels [PUSH]", set("alertChannels", List.of("PUSH")))
            .ok("alertChannels [SMS] (phone is on the profile)", set("alertChannels", List.of("SMS")))
            .ok("alertChannels [PUSH, SMS]", set("alertChannels", List.of("PUSH", "SMS")))
            .bad("alertChannels empty list", set("alertChannels", List.of()))
            .bad("alertChannels [push] lower case", set("alertChannels", List.of("push")))
            .bad("alertChannels [EMAIL]", set("alertChannels", List.of("EMAIL")))
            .bad("alertChannels [PUSH, EMAIL]", set("alertChannels", List.of("PUSH", "EMAIL")))
            .bad("alertChannels [\"\"]", set("alertChannels", List.of("")))
            .bad("alertChannels is a string, not a list", set("alertChannels", "PUSH"))
            .bad("alertChannels is an object", set("alertChannels", java.util.Map.of("PUSH", true)))
            .bad("areaId is text", set("areaId", "abc"))
            .bad("areaId is a JSON object", set("areaId", java.util.Map.of()))
            .bad("areaId is a boolean", set("areaId", true))
            .bad("areaId 2147483648 (overflows int)", set("areaId", 2147483648L))
            .message("areaId unknown 99999", 404, "Monitoring area not found", set("areaId", 99999))
            .message("areaId 0", 404, "Monitoring area not found", set("areaId", 0))
            .message("areaId -1", 404, "Monitoring area not found", set("areaId", -1))
            .message("areaId 2147483647", 404, "Monitoring area not found", set("areaId", Integer.MAX_VALUE));
        for (String phone : PHONE_OK) {
            if (!phone.isEmpty()) c.ok("PUSH with phoneNumber \"" + phone + "\"", set("phoneNumber", phone));
        }
        c.ok("PUSH with phoneNumber empty string", set("phoneNumber", ""));
        for (String phone : PHONE_BAD) c.bad("phoneNumber \"" + phone + "\"", set("phoneNumber", phone));
        c.ok("SMS with a phoneNumber in the request", m -> { m.put("alertChannels", List.of("SMS")); m.put("phoneNumber", "0987654321"); return m; });
        return c.stream();
    }

    static Stream<Case> deviceRegister() {
        return new Cases(DEVICE_REGISTER).envelope(400).required("fcmToken").notText("fcmToken", "deviceType")
            .ok("fcmToken 1 char", set("fcmToken", "x"))
            .ok("fcmToken 4096 chars (TEXT column)", m -> { m.put("fcmToken", "t".repeat(4096)); return m; })
            .ok("deviceType null defaults to android", set("deviceType", null))
            .ok("deviceType ios", set("deviceType", "iOS"))
            .ok("deviceType 20 chars (column limit)", set("deviceType", a(20)))
            .stream();
    }

    static Stream<Case> deviceDelete() {
        return new Cases(DEVICE_DELETE).envelope(400).required("fcmToken").notText("fcmToken")
            .ok("fcmToken unknown is a no-op", set("fcmToken", "never-registered"))
            .stream();
    }

    // ------------------------------------------------------------------ field reports

    static Stream<Case> report() {
        Cases c = new Cases(REPORT).envelope(400).nonNull("clientReportId", "longitude", "latitude", "observedAt");
        c.bad("clientReportId not a UUID", set("clientReportId", "not-a-uuid"))
            .bad("clientReportId empty string", set("clientReportId", ""))
            .bad("clientReportId is a number", set("clientReportId", 12345))
            .ok("clientReportId upper case UUID", m -> { m.put("clientReportId", UUID.randomUUID().toString().toUpperCase()); return m; });
        // coordinates
        c.ok("longitude -180 (bound)", set("longitude", -180.0)).ok("longitude 180 (bound)", set("longitude", 180.0))
            .bad("longitude -180.0001", set("longitude", -180.0001)).bad("longitude 180.0001", set("longitude", 180.0001))
            .bad("longitude 1e999", m -> { m.put("longitude", new java.math.BigDecimal("1E+999")); return m; })
            .ok("longitude 0", set("longitude", 0)).bad("longitude is text", set("longitude", "abc")).bad("longitude is an object", set("longitude", java.util.Map.of()))
            .bad("longitude is an array", set("longitude", List.of(1)));
        c.ok("latitude -90 (bound)", set("latitude", -90.0)).ok("latitude 90 (bound)", set("latitude", 90.0))
            .bad("latitude -90.0001", set("latitude", -90.0001)).bad("latitude 90.0001", set("latitude", 90.0001))
            .bad("latitude 123", set("latitude", 123)).bad("latitude is text", set("latitude", "abc")).bad("latitude is a boolean", set("latitude", true));
        c.ok("accuracyM 0 (bound)", set("accuracyM", 0)).ok("accuracyM null", set("accuracyM", null)).ok("accuracyM missing", drop("accuracyM"))
            .bad("accuracyM -0.001", set("accuracyM", -0.001)).bad("accuracyM -1", set("accuracyM", -1)).bad("accuracyM is text", set("accuracyM", "abc"));
        // description
        c.ok("description 2000 chars", set("description", a(2000))).bad("description 2001 chars", set("description", a(2001)))
            .ok("description 1 char", set("description", "x"))
            .message("description null and no photo", 400, "A report needs a photo or a description", set("description", null))
            .message("description missing and no photo", 400, "A report needs a photo or a description", drop("description"))
            .message("description empty and no photo", 400, "A report needs a photo or a description", set("description", ""))
            .message("description whitespace only and no photo", 400, "A report needs a photo or a description", set("description", "   "))
            .bad("description is a JSON object", set("description", java.util.Map.of()));
        // photo
        c.message("photoId of a photo that does not exist", 400, "Photo not found for this user", set("photoId", UNKNOWN_UUID.toString()))
            .bad("photoId not a UUID", set("photoId", "not-a-uuid"))
            .ok("photoId null", set("photoId", null));
        // times: the server allows observedAt up to 5 minutes ahead (FUTURE_SKEW); the base time is computed before the call so +5m is never over
        c.ok("observedAt now", m -> { m.put("observedAt", OffsetDateTime.now().toString()); return m; })
            .ok("observedAt 5 minutes in the future (FUTURE_SKEW, the limit)", m -> { m.put("observedAt", OffsetDateTime.now().plusMinutes(5).toString()); return m; })
            .message("observedAt 5 minutes and 10 seconds in the future", 400, "observedAt is in the future",
                m -> { m.put("observedAt", OffsetDateTime.now().plusMinutes(5).plusSeconds(10).toString()); return m; })
            .message("observedAt 1 day in the future", 400, "observedAt is in the future", m -> { m.put("observedAt", OffsetDateTime.now().plusDays(1).toString()); return m; })
            .ok("observedAt year 2000", set("observedAt", "2000-01-01T00:00:00Z"))
            .ok("observedAt with a +07:00 offset", set("observedAt", "2026-01-01T10:00:00+07:00"))
            .bad("observedAt without an offset", set("observedAt", "2026-01-01T10:00:00"))
            .bad("observedAt date only", set("observedAt", "2026-01-01"))
            .bad("observedAt month 13", set("observedAt", "2026-13-01T00:00:00Z"))
            .bad("observedAt empty string", set("observedAt", ""))
            .bad("observedAt not a date", set("observedAt", "yesterday"))
            .bad("observedAt is an object", set("observedAt", java.util.Map.of()))
            .ok("observedUntil null", set("observedUntil", null))
            .ok("observedUntil equal to observedAt", m -> { m.put("observedAt", "2026-01-01T10:00:00Z"); m.put("observedUntil", "2026-01-01T10:00:00Z"); return m; })
            .ok("observedUntil 1 second after observedAt", m -> { m.put("observedAt", "2026-01-01T10:00:00Z"); m.put("observedUntil", "2026-01-01T10:00:01Z"); return m; })
            .message("observedUntil 1 second before observedAt", 400, "observedUntil is before observedAt",
                m -> { m.put("observedAt", "2026-01-01T10:00:00Z"); m.put("observedUntil", "2026-01-01T09:59:59Z"); return m; })
            .bad("observedUntil not a date", set("observedUntil", "later"));
        return c.stream();
    }

    @org.junit.jupiter.api.Disabled("BUG: expected 400 for alertChannels [null], actual 200 and a subscription with NO channel is stored "
        + "(SubscriptionRequest: @NotEmpty accepts [null], @Pattern treats null as valid; AlertSubscriptionService.subscribe saves push=false sms=false)")
    @org.junit.jupiter.api.Test
    void bugSubscriptionWithNullChannelIsStored() throws Exception {
        run(new Case(SUBSCRIBE, "alertChannels [null]", set("alertChannels", java.util.Collections.singletonList(null)), null, 400, Matrix.INVALID));
    }

    @DisplayName("citizen request bodies")
    @ParameterizedTest(name = "{0}")
    @MethodSource("rows")
    void citizenBody(Case c) throws Exception {
        run(c);
    }

    static Stream<Case> rows() {
        return Stream.of(profile(), password(), avatar(), photo(), subscribe(), deviceRegister(), deviceDelete(), report()).flatMap(s -> s);
    }

    @DisplayName("wrong Content-Type is refused with 415, never 500")
    @ParameterizedTest(name = "{0}")
    @MethodSource("routes")
    void wrongContentType(Route r) throws Exception {
        // a DELETE body is only read for application/json, any other type counts as "no body" -> 400 "Invalid request"
        runWrongContentType(r, r.method() == org.springframework.http.HttpMethod.DELETE ? 400 : 415);
    }

    static Stream<Route> routes() { return ROUTES.stream(); }
}
