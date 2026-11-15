package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** What field-report routes store, return and announce; who may read them is covered by AuthorizationMatrixTest. */
class CommunityReportFlowApiTest extends FlowTestBase {
    private static final String BASE = "/api/v1/community-reports";

    private int seedReport(UUID userId, UUID clientId, String description, String reportTimeOffset) {
        return jdbc.queryForObject("""
            INSERT INTO core_schema.community_reports (user_id, client_report_id, location, description, status, report_time)
            VALUES (?, ?, ST_SetSRID(ST_MakePoint(104.5, 21.5), 4326), ?, 'submitted', now() + CAST(? AS interval))
            RETURNING report_id
            """, Integer.class, userId, clientId, description, reportTimeOffset);
    }

    private Map<String, Object> report(UUID clientId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientReportId", clientId.toString());
        body.put("longitude", 104.113);
        body.put("latitude", 21.864);
        body.put("description", "Dat da tran qua duong");
        body.put("observedAt", OffsetDateTime.now().minusHours(1).toString());
        return body;
    }

    @Test
    void staffListIsNewestFirstAndCarriesLocationAndSubmitterContact() throws Exception {
        Acct officer = account("officer");
        Acct reporter = account("citizen", "Nguyen Van Bao", "0912345678");
        int older = seedReport(reporter.id(), UUID.randomUUID(), "older report", "-2 hours");
        int newer = seedReport(reporter.id(), UUID.randomUUID(), "newer report", "-1 hour");
        int anonymous = seedReport(null, null, "left by a deleted account", "-30 minutes");

        JsonNode rows = read(call(HttpMethod.GET, BASE, officer, null));

        List<Integer> ids = new ArrayList<>();
        rows.forEach(r -> ids.add(r.get("report_id").asInt()));
        assertThat(ids).containsSubsequence(anonymous, newer, older);
        JsonNode row = null;
        for (JsonNode r : rows) if (r.get("report_id").asInt() == newer) row = r;
        assertThat(row.get("description").asText()).isEqualTo("newer report");
        assertThat(row.get("status").asText()).isEqualTo("submitted");
        assertThat(row.get("longitude").asDouble()).isEqualTo(104.5);
        assertThat(row.get("latitude").asDouble()).isEqualTo(21.5);
        assertThat(row.get("submitter_name").asText()).isEqualTo("Nguyen Van Bao");
        assertThat(row.get("submitter_phone").asText()).isEqualTo("0912345678");
        // a report whose account is gone is still listed, with no submitter
        for (JsonNode r : rows) {
            if (r.get("report_id").asInt() == anonymous) assertThat(r.get("submitter_name").isNull()).isTrue();
        }
    }

    @Test
    void statusUpdateIsNormalisedStoredAnnouncedAndReturned() throws Exception {
        Acct officer = account("officer");
        int id = seedReport(account("citizen").id(), UUID.randomUUID(), "to process", "0 seconds");
        MvcResult stream = openStream();

        call(HttpMethod.PATCH, BASE + "/" + id + "/status", officer, Map.of("status", " PROCESSED "))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reportId").value(id))
            .andExpect(jsonPath("$.status").value("processed"));

        assertThat(jdbc.queryForObject("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", String.class, id))
            .isEqualTo("processed");
        assertThat(updates(stream)).containsExactly("field_reports");

        call(HttpMethod.PATCH, BASE + "/" + id + "/status", officer, Map.of("status", "archived")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", String.class, id))
            .isEqualTo("archived");
        assertThat(updates(stream)).containsExactly("field_reports", "field_reports");
    }

    @Test
    void rejectedOrUnknownStatusUpdateChangesNothingAndAnnouncesNothing() throws Exception {
        Acct officer = account("officer");
        int id = seedReport(account("citizen").id(), UUID.randomUUID(), "untouched", "0 seconds");
        MvcResult stream = openStream();

        call(HttpMethod.PATCH, BASE + "/" + id + "/status", officer, Map.of("status", "deleted")).andExpect(status().isBadRequest());
        call(HttpMethod.PATCH, BASE + "/" + (id + 100_000) + "/status", officer, Map.of("status", "processed")).andExpect(status().isNotFound());

        assertThat(jdbc.queryForObject("SELECT status::text FROM core_schema.community_reports WHERE report_id = ?", String.class, id))
            .isEqualTo("submitted");
        assertThat(updates(stream)).isEmpty();
    }

    @Test
    void dashboardIsToldOnlyWhenASubmissionIsNewNotOnAReplay() throws Exception {
        Acct citizen = account("citizen");
        UUID clientId = UUID.randomUUID();
        MvcResult stream = openStream();

        call(HttpMethod.POST, BASE, citizen, report(clientId)).andExpect(status().isCreated());
        assertThat(updates(stream)).hasSize(1);

        call(HttpMethod.POST, BASE, citizen, report(clientId)).andExpect(status().isOk());
        assertThat(updates(stream)).hasSize(1);

        call(HttpMethod.POST, BASE, citizen, report(UUID.randomUUID())).andExpect(status().isCreated());
        assertThat(updates(stream)).containsExactly("field_reports", "field_reports");
    }

    @Test
    void sameClientReportIdFromTwoUsersIsTwoReports() throws Exception {
        Acct first = account("citizen");
        Acct second = account("citizen");
        UUID clientId = UUID.randomUUID();

        call(HttpMethod.POST, BASE, first, report(clientId)).andExpect(status().isCreated());
        call(HttpMethod.POST, BASE, second, report(clientId)).andExpect(status().isCreated());

        assertThat(count("SELECT count(*) FROM core_schema.community_reports WHERE client_report_id = ?", clientId)).isEqualTo(2);
        call(HttpMethod.GET, BASE + "/mine", first, null).andExpect(jsonPath("$.length()").value(1));
        call(HttpMethod.GET, BASE + "/mine", second, null).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void mineListsOnlyMyReportsNewestFirstWithLocationAndStatus() throws Exception {
        Acct me = account("citizen");
        Acct other = account("citizen");
        UUID olderClient = UUID.randomUUID();
        UUID newerClient = UUID.randomUUID();
        seedReport(me.id(), olderClient, "older", "-3 hours");
        seedReport(me.id(), newerClient, "newer", "-1 hour");
        seedReport(other.id(), UUID.randomUUID(), "someone else", "0 seconds");

        call(HttpMethod.GET, BASE + "/mine", me, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].clientReportId").value(newerClient.toString()))
            .andExpect(jsonPath("$[0].description").value("newer"))
            .andExpect(jsonPath("$[0].status").value("submitted"))
            .andExpect(jsonPath("$[0].latitude").value(21.5))
            .andExpect(jsonPath("$[0].longitude").value(104.5))
            .andExpect(jsonPath("$[1].clientReportId").value(olderClient.toString()));
    }

    @Test
    void jpegPhotoIsServedWithItsOwnTypeAndAPrivateOneHourCache() throws Exception {
        Acct citizen = account("citizen");
        Acct officer = account("officer");
        String photoId = read(call(HttpMethod.POST, BASE + "/photos", citizen, Map.of("imageBase64", JPEG))
            .andExpect(status().isOk())).get("photoId").asText();

        byte[] served = call(HttpMethod.GET, BASE + "/photos/" + photoId, officer, null)
            .andExpect(status().isOk())
            .andExpect(content().contentType("image/jpeg"))
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.allOf(
                org.hamcrest.Matchers.containsString("max-age=3600"), org.hamcrest.Matchers.containsString("private"))))
            .andReturn().getResponse().getContentAsByteArray();

        assertThat(served).isEqualTo(java.util.Base64.getDecoder().decode(JPEG));
    }
}
