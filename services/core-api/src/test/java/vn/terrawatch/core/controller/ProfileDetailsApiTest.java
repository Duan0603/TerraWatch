package vn.terrawatch.core.controller;

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

import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class ProfileDetailsApiTest {
    // 1x1 PNG
    private static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private ResultActions call(HttpMethod method, String path, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }

    private String register(String email) throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "Test User", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private Map<String, Object> profile(Object... overrides) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fullName", "Nguyen Van A");
        for (int i = 0; i < overrides.length; i += 2) body.put((String) overrides[i], overrides[i + 1]);
        return body;
    }

    @Test
    void detailsAreStoredReturnedAndClearedByBlankValues() throws Exception {
        String token = register("details@api-test.example");
        call(HttpMethod.PUT, "/api/v1/auth/me", token, profile(
            "phoneNumber", "0912345678", "dateOfBirth", "1990-05-20", "gender", "female",
            "province", "Yen Bai", "district", "Mu Cang Chai", "commune", "Lim Mong", "addressLine", "Ban Lim Mong 3",
            "emergencyContactName", "Tran Thi B", "emergencyContactPhone", "0987654321", "emergencyContactRelation", "Me"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dateOfBirth").value("1990-05-20"))
            .andExpect(jsonPath("$.gender").value("female"))
            .andExpect(jsonPath("$.province").value("Yen Bai"))
            .andExpect(jsonPath("$.addressLine").value("Ban Lim Mong 3"))
            .andExpect(jsonPath("$.emergencyContactName").value("Tran Thi B"))
            .andExpect(jsonPath("$.emergencyContactPhone").value("0987654321"))
            .andExpect(jsonPath("$.hasAvatar").value(false));
        call(HttpMethod.GET, "/api/v1/auth/me", token, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.commune").value("Lim Mong"));
        // PUT replaces everything: blank or missing optional fields are cleared
        call(HttpMethod.PUT, "/api/v1/auth/me", token, profile("province", "  ", "gender", ""))
            .andExpect(status().isOk()).andExpect(jsonPath("$.province").doesNotExist())
            .andExpect(jsonPath("$.dateOfBirth").doesNotExist()).andExpect(jsonPath("$.emergencyContactName").doesNotExist());
    }

    @Test
    void rejectsBadGenderFutureOrAncientBirthDateAndBadEmergencyPhone() throws Exception {
        String token = register("invalid@api-test.example");
        call(HttpMethod.PUT, "/api/v1/auth/me", token, profile("gender", "robot")).andExpect(status().isBadRequest());
        call(HttpMethod.PUT, "/api/v1/auth/me", token, profile("dateOfBirth", "2999-01-01")).andExpect(status().isBadRequest());
        call(HttpMethod.PUT, "/api/v1/auth/me", token, profile("dateOfBirth", "1850-01-01")).andExpect(status().isBadRequest());
        call(HttpMethod.PUT, "/api/v1/auth/me", token, profile("emergencyContactPhone", "12")).andExpect(status().isBadRequest());
    }

    @Test
    void avatarRoundTripOwnerOnlyAndStrictlyValidated() throws Exception {
        String owner = register("avatar-owner@api-test.example");
        String other = register("avatar-other@api-test.example");

        call(HttpMethod.GET, "/api/v1/auth/me/avatar", null, null).andExpect(status().isUnauthorized());
        call(HttpMethod.GET, "/api/v1/auth/me/avatar", owner, null).andExpect(status().isNotFound());

        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", owner, Map.of("imageBase64", "***not base64***")).andExpect(status().isBadRequest());
        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", owner,
            Map.of("imageBase64", Base64.getEncoder().encodeToString("just text, not an image".getBytes()))).andExpect(status().isBadRequest());
        byte[] huge = new byte[210_000];
        Arrays.fill(huge, (byte) 1);
        huge[0] = (byte) 0xFF; huge[1] = (byte) 0xD8; huge[2] = (byte) 0xFF;
        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", owner,
            Map.of("imageBase64", Base64.getEncoder().encodeToString(huge))).andExpect(status().isBadRequest());

        call(HttpMethod.PUT, "/api/v1/auth/me/avatar", owner, Map.of("imageBase64", PNG))
            .andExpect(status().isOk()).andExpect(jsonPath("$.hasAvatar").value(true));
        call(HttpMethod.GET, "/api/v1/auth/me/avatar", owner, null)
            .andExpect(status().isOk()).andExpect(jsonPath("$.imageBase64").value(PNG));
        call(HttpMethod.GET, "/api/v1/auth/me/avatar", other, null).andExpect(status().isNotFound());

        call(HttpMethod.DELETE, "/api/v1/auth/me/avatar", owner, null).andExpect(status().isNoContent());
        call(HttpMethod.GET, "/api/v1/auth/me/avatar", owner, null).andExpect(status().isNotFound());
        call(HttpMethod.GET, "/api/v1/auth/me", owner, null).andExpect(jsonPath("$.hasAvatar").value(false));
    }
}
