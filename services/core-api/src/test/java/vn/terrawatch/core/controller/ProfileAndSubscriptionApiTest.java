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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class ProfileAndSubscriptionApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private ResultActions call(HttpMethod method, String path, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }

    private String registerAndGetToken(String email) throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "Test User", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void protectedRoutesRequireAToken() throws Exception {
        call(HttpMethod.GET, "/api/v1/alerts/subscriptions", null, null).andExpect(status().isUnauthorized());
        call(HttpMethod.PUT, "/api/v1/auth/me", null, Map.of("fullName", "x")).andExpect(status().isUnauthorized());
        call(HttpMethod.PUT, "/api/v1/auth/password", null,
            Map.of("currentPassword", "a", "newPassword", "bbbbbbbb")).andExpect(status().isUnauthorized());
    }

    @Test
    void profileUpdateAndPasswordChangeRoundTrip() throws Exception {
        String token = registerAndGetToken("profile@api-test.example");
        call(HttpMethod.PUT, "/api/v1/auth/me", token, Map.of("fullName", "New Name", "phoneNumber", "0912345678"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.fullName").value("New Name"))
            .andExpect(jsonPath("$.phoneNumber").value("0912345678"))
            .andExpect(jsonPath("$.authProvider").value("email"));
        call(HttpMethod.PUT, "/api/v1/auth/me", token, Map.of("fullName", "New Name", "phoneNumber", "abc"))
            .andExpect(status().isBadRequest());
        call(HttpMethod.PUT, "/api/v1/auth/password", token, Map.of("currentPassword", "nope", "newPassword", "newpass123"))
            .andExpect(status().isBadRequest());
        call(HttpMethod.PUT, "/api/v1/auth/password", token, Map.of("currentPassword", "secret123", "newPassword", "newpass123"))
            .andExpect(status().isNoContent());
        call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "profile@api-test.example", "password", "newpass123"))
            .andExpect(status().isOk());
    }

    @Test
    void subscribeListAndOnlyOwnerCanRemove() throws Exception {
        String owner = registerAndGetToken("owner@api-test.example");
        String other = registerAndGetToken("other@api-test.example");

        String created = call(HttpMethod.POST, "/api/v1/alerts/subscriptions", owner,
            Map.of("areaId", 1, "alertChannels", java.util.List.of("PUSH", "SMS"), "phoneNumber", "0912345678"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.areaName").isNotEmpty())
            .andReturn().getResponse().getContentAsString();
        String id = json.readTree(created).get("subscriptionId").asText();

        // same area again updates channels instead of creating a duplicate
        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", owner,
            Map.of("areaId", 1, "alertChannels", java.util.List.of("PUSH"))).andExpect(status().isOk());
        JsonNode listed = json.readTree(call(HttpMethod.GET, "/api/v1/alerts/subscriptions", owner, null)
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        org.assertj.core.api.Assertions.assertThat(listed).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(listed.get(0).get("alertChannels")).hasSize(1);

        call(HttpMethod.DELETE, "/api/v1/alerts/subscriptions/" + id, other, null).andExpect(status().isNotFound());
        call(HttpMethod.DELETE, "/api/v1/alerts/subscriptions/" + id, owner, null).andExpect(status().isNoContent());
        call(HttpMethod.POST, "/api/v1/alerts/subscriptions", owner,
            Map.of("areaId", 99999, "alertChannels", java.util.List.of("PUSH"))).andExpect(status().isNotFound());
    }
}
