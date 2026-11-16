package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pairwise table of sending a field report (PW-RPT-001..010): photo x description x observed time x network x repeat.
 * The server sees: the photo upload (its own call, 400 over 700 KB), then the report (400 for a missing or future time, for
 * more than 2000 characters, or for neither a photo nor a description), then a repeat of the same clientReportId.
 * "Network lost" is a phone-side queue (the app keeps the report and sends it later); the server never sees that state, so
 * the column is recorded as not automatable at API level. Its server-side face is the repeat: a phone whose answer was lost
 * sends the same clientReportId again and must get the stored report back with 200, not a second row (the "repeat" column).
 * An over-size photo is refused at upload, so the report that follows has no photo (it stands or falls on its description).
 */
class FieldReportPairwiseApiTest extends FlowTestBase {
    private static final String BASE = "/api/v1/community-reports";

    private static String bigImage() {
        byte[] bytes = new byte[700_001];
        bytes[0] = (byte) 0xFF; bytes[1] = (byte) 0xD8; bytes[2] = (byte) 0xFF; bytes[3] = (byte) 0xE0;
        return Base64.getEncoder().encodeToString(bytes);
    }

    @ParameterizedTest(name = "{0}: photo {1}, description {2}, time {3}, repeat {4} -> {5}")
    @CsvSource({
        "PW-RPT-001, none,     none,  now,     false, 400",
        "PW-RPT-002, none,     valid, future6, true,  400",
        "PW-RPT-003, valid,    long,  missing, true,  400",
        "PW-RPT-004, oversize, none,  missing, false, 400",
        "PW-RPT-005, valid,    valid, now,     false, 201",
        "PW-RPT-006, oversize, long,  future6, false, 400",
        "PW-RPT-007, oversize, valid, now,     true,  201",
        "PW-RPT-008, valid,    none,  future6, true,  400",
        "PW-RPT-009, none,     long,  now,     false, 400",
        "PW-RPT-010, none,     valid, missing, false, 400"
    })
    void reportCombinationIsAcceptedOnlyWhenEveryPartIsValid(String id, String photo, String description, String time, boolean repeat,
                                                             int expected) throws Exception {
        Acct citizen = account("citizen");
        String photoId = null;
        if (!photo.equals("none")) {
            var upload = call(HttpMethod.POST, BASE + "/photos", citizen, Map.of("imageBase64", photo.equals("valid") ? PNG : bigImage()));
            if (photo.equals("valid")) {
                photoId = read(upload.andExpect(status().isOk())).get("photoId").asText();
            } else {
                upload.andExpect(status().isBadRequest());
                assertThat(count("SELECT count(*) FROM core_schema.report_photos WHERE user_id = ?", citizen.id())).isZero();
            }
        }
        UUID clientId = UUID.randomUUID();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientReportId", clientId.toString());
        body.put("longitude", 104.113);
        body.put("latitude", 21.864);
        if (photoId != null) body.put("photoId", photoId);
        if (description.equals("valid")) body.put("description", "Đất đá tràn qua đường");
        if (description.equals("long")) body.put("description", "d".repeat(2001));
        switch (time) {
            case "now" -> body.put("observedAt", OffsetDateTime.now().toString());
            case "future6" -> body.put("observedAt", OffsetDateTime.now().plusMinutes(6).toString());
            default -> { }
        }
        MvcResult stream = openStream();

        var first = call(HttpMethod.POST, BASE, citizen, body).andExpect(status().is(expected));

        String sql = "SELECT count(*) FROM core_schema.community_reports WHERE user_id = ?";
        if (expected == 201) {
            JsonNode created = read(first);
            assertThat(created.get("status").asText()).isEqualTo("submitted");
            assertThat(created.get("description").asText()).isEqualTo("Đất đá tràn qua đường");
            if (photoId == null) assertThat(created.get("imageUrl").isNull()).isTrue();
            else assertThat(created.get("imageUrl").asText()).isEqualTo(BASE + "/photos/" + photoId);
            assertThat(count(sql, citizen.id())).isEqualTo(1);
            assertThat(updates(stream)).containsExactly("field_reports");
            if (repeat) {
                // the answer was lost on the way: the phone sends the same report again
                JsonNode again = read(call(HttpMethod.POST, BASE, citizen, body).andExpect(status().isOk()));
                assertThat(again.get("reportId")).isEqualTo(created.get("reportId"));
                assertThat(count(sql, citizen.id())).isEqualTo(1);
                assertThat(updates(stream)).as("a repeat announces nothing").containsExactly("field_reports");
            }
        } else {
            assertThat(count(sql, citizen.id())).isZero();
            assertThat(updates(stream)).isEmpty();
            if (repeat) {
                // a refused report stays refused when sent again, and still leaves no row
                call(HttpMethod.POST, BASE, citizen, body).andExpect(status().isBadRequest());
                assertThat(count(sql, citizen.id())).isZero();
            }
            // what the citizen still has on the phone's list: nothing
            assertThat(read(call(HttpMethod.GET, BASE + "/mine", citizen, null).andExpect(status().isOk())).size()).isZero();
        }
    }
}
