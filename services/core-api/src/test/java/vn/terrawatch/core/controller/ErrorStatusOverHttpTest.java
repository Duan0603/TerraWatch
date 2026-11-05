package vn.terrawatch.core.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import vn.terrawatch.core.repository.UserRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * MockMvc cannot show this: on a real server an error that no @ExceptionHandler covers goes through
 * the container's /error dispatch, which Spring Security answers with 401. Clients treat a 401 on an
 * authenticated call as "session expired" and sign the user out, so every controller that raises
 * ResponseStatusException must be covered by the advice. This test runs over real HTTP.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ErrorStatusOverHttpTest {
    private static final String EMAIL = "error-status@http-test.example";

    @Autowired TestRestTemplate http;
    @Autowired UserRepository users;

    @AfterEach
    void cleanUp() {
        users.findByEmail(EMAIL).ifPresent(users::delete);
    }

    private HttpHeaders registerAndAuthorize() {
        var registered = http.postForEntity("/api/v1/auth/register",
            Map.of("fullName", "Http Test", "email", EMAIL, "password", "secret123"), Map.class);
        assertThat(registered.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth((String) registered.getBody().get("token"));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private HttpStatus send(HttpMethod method, String path, HttpHeaders headers, Object body) {
        return HttpStatus.valueOf(http.exchange(path, method, new HttpEntity<>(body, headers), String.class).getStatusCode().value());
    }

    @Test
    void subscriptionErrorsKeepTheirRealStatusInsteadOfBecoming401() {
        HttpHeaders headers = registerAndAuthorize();
        assertThat(send(HttpMethod.POST, "/api/v1/alerts/subscriptions", headers,
            Map.of("areaId", 99999, "alertChannels", List.of("PUSH")))).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(send(HttpMethod.POST, "/api/v1/alerts/subscriptions", headers,
            Map.of("areaId", 1, "alertChannels", List.of()))).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(send(HttpMethod.DELETE, "/api/v1/alerts/subscriptions/" + UUID.randomUUID(), headers, null))
            .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void avatarErrorsKeepTheirRealStatusInsteadOfBecoming401() {
        HttpHeaders headers = registerAndAuthorize();
        assertThat(send(HttpMethod.GET, "/api/v1/auth/me/avatar", headers, null)).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(send(HttpMethod.PUT, "/api/v1/auth/me/avatar", headers, Map.of("imageBase64", "aGVsbG8=")))
            .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(send(HttpMethod.PUT, "/api/v1/auth/me/avatar", headers, Map.of("imageBase64", "")))
            .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void fieldReportErrorsKeepTheirRealStatusInsteadOfBecoming401() {
        HttpHeaders headers = registerAndAuthorize();
        // unknown photo is public and must be 404, bad photo 400, an invalid report 400
        assertThat(send(HttpMethod.GET, "/api/v1/community-reports/photos/" + UUID.randomUUID(), new HttpHeaders(), null))
            .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(send(HttpMethod.POST, "/api/v1/community-reports/photos", headers, Map.of("imageBase64", "aGVsbG8=")))
            .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(send(HttpMethod.POST, "/api/v1/community-reports", headers,
            Map.of("clientReportId", UUID.randomUUID().toString(), "longitude", 104.1, "latitude", 95.0,
                "description", "x", "observedAt", "2026-10-01T00:00:00Z"))).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
