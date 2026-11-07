package vn.terrawatch.core.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.client.FcmSender;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Transactional
class AdminUserApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @PersistenceContext EntityManager entityManager;
    @MockBean FcmSender fcm;

    private ResultActions call(HttpMethod method, String path, String token, Object body) throws Exception {
        MockHttpServletRequestBuilder builder = request(method, path);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        return mvc.perform(builder);
    }

    private String register(String email) throws Exception {
        String body = call(HttpMethod.POST, "/api/v1/auth/register", null,
            Map.of("fullName", "User Test", "email", email, "password", "secret123"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private String withRole(String email, String role) throws Exception {
        register(email);
        jdbc.update("UPDATE core_schema.users SET role = CAST(? AS core_schema.user_role) WHERE email = ?", role, email);
        entityManager.clear();
        String body = call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", email, "password", "secret123"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    @Test
    void userManagementEndpointsAreAdminOnly() throws Exception {
        String citizen = register("citizen-admin-test@example.com");
        String officer = withRole("officer-admin-test@example.com", "officer");

        call(HttpMethod.GET, "/api/v1/admin/users", null, null).andExpect(status().isUnauthorized());
        call(HttpMethod.GET, "/api/v1/admin/users", citizen, null).andExpect(status().isForbidden());
        call(HttpMethod.GET, "/api/v1/admin/users", officer, null).andExpect(status().isForbidden());
    }

    @Test
    void adminCanListAndFilterUsers() throws Exception {
        String admin = withRole("admin-list@example.com", "admin");
        register("user-filter-target@example.com");

        String res = call(HttpMethod.GET, "/api/v1/admin/users?search=user-filter-target", admin, null)
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        JsonNode users = json.readTree(res);
        assertTrue(users.isArray());
        assertTrue(users.size() >= 1);
        assertEquals("user-filter-target@example.com", users.get(0).get("email").asText());
    }

    @Test
    void adminCanLockAndUnlockUser() throws Exception {
        String admin = withRole("admin-lock@example.com", "admin");
        register("target-lock@example.com");

        UUID targetId = jdbc.queryForObject(
            "SELECT user_id FROM core_schema.users WHERE email = 'target-lock@example.com'", UUID.class);

        // Lock user
        call(HttpMethod.PATCH, "/api/v1/admin/users/" + targetId + "/status", admin, Map.of("isActive", false))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isActive").value(false));

        // Attempt login while locked -> 403 Forbidden
        call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "target-lock@example.com", "password", "secret123"))
            .andExpect(status().isForbidden());

        // Unlock user
        call(HttpMethod.PATCH, "/api/v1/admin/users/" + targetId + "/status", admin, Map.of("isActive", true))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isActive").value(true));

        // Login succeeds again
        call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "target-lock@example.com", "password", "secret123"))
            .andExpect(status().isOk());
    }

    @Test
    void adminCannotLockSelf() throws Exception {
        String admin = withRole("admin-self-lock@example.com", "admin");
        UUID adminId = jdbc.queryForObject(
            "SELECT user_id FROM core_schema.users WHERE email = 'admin-self-lock@example.com'", UUID.class);

        call(HttpMethod.PATCH, "/api/v1/admin/users/" + adminId + "/status", admin, Map.of("isActive", false))
            .andExpect(status().isBadRequest());
    }

    @Test
    void adminCanApproveAndRejectOfficerRegistration() throws Exception {
        String admin = withRole("admin-approver@example.com", "admin");

        // Officer registers with requestedRole = "officer"
        call(HttpMethod.POST, "/api/v1/auth/register", null, Map.of(
            "fullName", "Pending Officer",
            "email", "pending-officer@example.com",
            "password", "secret123",
            "requestedRole", "officer"
        )).andExpect(status().isCreated())
          .andExpect(jsonPath("$.token").doesNotExist());

        // Login is rejected while pending
        call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "pending-officer@example.com", "password", "secret123"))
            .andExpect(status().isForbidden());

        UUID officerId = jdbc.queryForObject(
            "SELECT user_id FROM core_schema.users WHERE email = 'pending-officer@example.com'", UUID.class);

        // Admin approves officer
        call(HttpMethod.POST, "/api/v1/admin/users/" + officerId + "/approve", admin, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("officer"))
            .andExpect(jsonPath("$.approvalStatus").value("approved"));

        // Officer can now login successfully
        call(HttpMethod.POST, "/api/v1/auth/login", null, Map.of("email", "pending-officer@example.com", "password", "secret123"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("officer"));
    }

    @Test
    void adminCanUpdateRole() throws Exception {
        String admin = withRole("admin-role-manager@example.com", "admin");
        register("user-role-test@example.com");
        UUID userId = jdbc.queryForObject(
            "SELECT user_id FROM core_schema.users WHERE email = 'user-role-test@example.com'", UUID.class);

        call(HttpMethod.PATCH, "/api/v1/admin/users/" + userId + "/role", admin, Map.of("role", "officer"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("officer"));

        // Update with invalid role fails
        call(HttpMethod.PATCH, "/api/v1/admin/users/" + userId + "/role", admin, Map.of("role", "superhero"))
            .andExpect(status().isBadRequest());
    }
}
