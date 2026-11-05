package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class FieldReportApiTest {
    private static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    private static final String BASE = "/api/v1/community-reports";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private ResultActions call(HttpMethod method, String path, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }

    private String register(String email) throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "Reporter", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private Map<String, Object> report(UUID clientId, Object... overrides) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientReportId", clientId.toString());
        body.put("longitude", 104.113);
        body.put("latitude", 21.864);
        body.put("accuracyM", 8.5);
        body.put("description", "Đất đá tràn qua đường");
        body.put("observedAt", OffsetDateTime.now().minusHours(2).toString());
        for (int i = 0; i < overrides.length; i += 2) body.put((String) overrides[i], overrides[i + 1]);
        return body;
    }

    @Test
    void writingRequiresASignedInUserButPhotosCanBeViewedPublicly() throws Exception {
        call(HttpMethod.POST, BASE, null, report(UUID.randomUUID())).andExpect(status().isUnauthorized());
        call(HttpMethod.POST, BASE + "/photos", null, Map.of("imageBase64", PNG)).andExpect(status().isUnauthorized());
        call(HttpMethod.GET, BASE + "/mine", null, null).andExpect(status().isUnauthorized());
        call(HttpMethod.GET, BASE, null, null).andExpect(status().isOk()); // the public list is unchanged
    }

    @Test
    void photoRoundTripReturnsTheImageBytes() throws Exception {
        String token = register("photo@field-test.example");
        String body = call(HttpMethod.POST, BASE + "/photos", token, Map.of("imageBase64", PNG))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String url = json.readTree(body).get("imageUrl").asText();
        byte[] bytes = call(HttpMethod.GET, url, null, null)
            .andExpect(status().isOk()).andExpect(content().contentType("image/png")).andReturn().getResponse().getContentAsByteArray();
        assertThat(bytes).isEqualTo(java.util.Base64.getDecoder().decode(PNG));
        call(HttpMethod.GET, BASE + "/photos/" + UUID.randomUUID(), null, null).andExpect(status().isNotFound());
    }

    @Test
    void submitIsIdempotentAndKeepsEventTimeSeparateFromReceiveTime() throws Exception {
        String token = register("submit@field-test.example");
        UUID clientId = UUID.randomUUID();
        String photoId = json.readTree(call(HttpMethod.POST, BASE + "/photos", token, Map.of("imageBase64", PNG))
            .andReturn().getResponse().getContentAsString()).get("photoId").asText();

        String first = call(HttpMethod.POST, BASE, token, report(clientId, "photoId", photoId))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("submitted"))
            .andExpect(jsonPath("$.imageUrl").value(BASE + "/photos/" + photoId))
            .andExpect(jsonPath("$.latitude").value(21.864)).andReturn().getResponse().getContentAsString();
        JsonNode created = json.readTree(first);
        assertThat(created.get("observedAt").asText()).isNotEqualTo(created.get("reportedAt").asText());

        String again = call(HttpMethod.POST, BASE, token, report(clientId, "photoId", photoId))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(again).get("reportId")).isEqualTo(created.get("reportId"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM core_schema.community_reports WHERE client_report_id = ?::uuid",
            Integer.class, clientId.toString())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT source FROM core_schema.community_reports WHERE client_report_id = ?::uuid",
            String.class, clientId.toString())).isEqualTo("mobile");

        call(HttpMethod.GET, BASE + "/mine", token, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].clientReportId").value(clientId.toString()));
    }

    @Test
    void identityComesFromTheTokenAndOtherUsersCannotSeeOrUseMyPhoto() throws Exception {
        String owner = register("owner@field-test.example");
        String other = register("other@field-test.example");
        String photoId = json.readTree(call(HttpMethod.POST, BASE + "/photos", owner, Map.of("imageBase64", PNG))
            .andReturn().getResponse().getContentAsString()).get("photoId").asText();

        // a userId in the body is ignored; the report belongs to the token's user
        call(HttpMethod.POST, BASE, owner, report(UUID.randomUUID(), "userId", "33333333-3333-3333-3333-333333333333"))
            .andExpect(status().isCreated());
        call(HttpMethod.GET, BASE + "/mine", other, null).andExpect(jsonPath("$.length()").value(0));
        call(HttpMethod.GET, BASE + "/mine", owner, null).andExpect(jsonPath("$.length()").value(1));
        call(HttpMethod.POST, BASE, other, report(UUID.randomUUID(), "photoId", photoId)).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsInvalidReports() throws Exception {
        String token = register("invalid@field-test.example");
        call(HttpMethod.POST, BASE, token, report(UUID.randomUUID(), "latitude", 123.0)).andExpect(status().isBadRequest());
        call(HttpMethod.POST, BASE, token, report(UUID.randomUUID(), "observedAt", OffsetDateTime.now().plusDays(1).toString()))
            .andExpect(status().isBadRequest());
        call(HttpMethod.POST, BASE, token, report(UUID.randomUUID(), "description", " ")).andExpect(status().isBadRequest());
        Map<String, Object> noClientId = report(UUID.randomUUID());
        noClientId.remove("clientReportId");
        call(HttpMethod.POST, BASE, token, noClientId).andExpect(status().isBadRequest());
        call(HttpMethod.POST, BASE + "/photos", token, Map.of("imageBase64", "aGVsbG8=")).andExpect(status().isBadRequest());
    }
}
