package vn.terrawatch.core.client;

import io.github.resilience4j.springboot3.circuitbreaker.autoconfigure.CircuitBreakerAutoConfiguration;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GisServiceClientTest {
    private static final String BASE = "http://gis.test:8002";
    private final RestTemplate rest = new RestTemplate();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(rest).build();
    private final GisServiceClient client = new GisServiceClient(rest, BASE);

    @Test
    void queryPostsBboxInLonLatOrderAndReturnsTheBody() {
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.bbox[0]").value(105.1)).andExpect(jsonPath("$.bbox[1]").value(21.2))
            .andExpect(jsonPath("$.bbox[2]").value(105.3)).andExpect(jsonPath("$.bbox[3]").value(21.4))
            .andExpect(jsonPath("$.max_cloud_coverage").value(20.0))
            .andRespond(withSuccess("{\"scenes_found\":[{\"id\":\"s1\"}]}", MediaType.APPLICATION_JSON));

        assertThat(client.querySatelliteScenes(105.1, 21.2, 105.3, 21.4)).containsKey("scenes_found");
        server.verify();
    }

    @Test
    void errorStatusesAndTransportFailuresSurfaceAsExceptionsNotData() {
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY));
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(request -> { throw new SocketTimeoutException("Read timed out"); });
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(request -> { throw new ConnectException("Connection refused"); });
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(withSuccess("not json", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.querySatelliteScenes(1, 2, 3, 4)).isInstanceOf(HttpClientErrorException.class);
        assertThatThrownBy(() -> client.querySatelliteScenes(1, 2, 3, 4)).isInstanceOf(HttpServerErrorException.class);
        assertThatThrownBy(() -> client.querySatelliteScenes(1, 2, 3, 4)).isInstanceOf(ResourceAccessException.class);
        assertThatThrownBy(() -> client.querySatelliteScenes(1, 2, 3, 4)).isInstanceOf(ResourceAccessException.class);
        assertThatThrownBy(() -> client.querySatelliteScenes(1, 2, 3, 4)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void fallbackReportsFailureWithNoScenes() {
        Map<String, Object> out = client.fallbackQuerySatellite(1, 2, 3, 4, new RuntimeException("down"));
        assertThat(out).containsEntry("success", false).containsEntry("status", "CIRCUIT_BREAKER_FALLBACK");
        assertThat((List<?>) out.get("scenes_found")).isEmpty();
    }

    @Test
    void throughTheProxyAnOutageBecomesTheFallbackAndTheCircuitOpens() {
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class, CircuitBreakerAutoConfiguration.class))
            .withBean(GisServiceClient.class, () -> new GisServiceClient(new RestTemplate(), BASE))
            .withPropertyValues("resilience4j.circuitbreaker.instances.gisService.slidingWindowSize=10",
                "resilience4j.circuitbreaker.instances.gisService.minimumNumberOfCalls=5",
                "resilience4j.circuitbreaker.instances.gisService.failureRateThreshold=50",
                "resilience4j.circuitbreaker.instances.gisService.waitDurationInOpenState=60s")
            .run(ctx -> {
                GisServiceClient proxied = ctx.getBean(GisServiceClient.class);
                var field = GisServiceClient.class.getDeclaredField("restTemplate");
                field.setAccessible(true);
                RestTemplate rt = (RestTemplate) field.get(org.springframework.aop.framework.AopProxyUtils.getSingletonTarget(proxied));
                MockRestServiceServer srv = MockRestServiceServer.bindTo(rt).build();
                for (int i = 0; i < 5; i++) srv.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
                for (int i = 0; i < 7; i++) {
                    assertThat(proxied.querySatelliteScenes(1, 2, 3, 4)).containsEntry("success", false);
                }
                srv.verify(); // only five reached the server
            });
    }

    @Test
    @Disabled("BUG: expected date range derived from today; actual GisServiceClient lines 38-39 hardcode date_from=2026-09-01 / date_to=2026-10-01, "
        + "so the catalog query never moves forward in time")
    void queryWindowFollowsTheCurrentDate() {
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite"))
            .andExpect(jsonPath("$.date_to").value(LocalDate.now().toString()))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        client.querySatelliteScenes(1, 2, 3, 4);
        server.verify();
    }

    @Test
    @Disabled("BUG: expected 200/empty body to read as unavailable; actual querySatelliteScenes returns null, which DiagnosticController line 48 serves as HTTP 200 empty")
    void emptyBodyIsNotNull() {
        server.expect(requestTo(BASE + "/api/v1/gis/query-satellite")).andRespond(withSuccess());
        assertThat(client.querySatelliteScenes(1, 2, 3, 4)).isNotNull();
    }

    @Test
    @Disabled("BUG: expected fallback message not to claim a cached catalog exists; actual fallbackQuerySatellite says 'Using cached satellite catalog' but returns no scenes")
    void fallbackMessageDoesNotClaimACache() {
        assertThat(client.fallbackQuerySatellite(1, 2, 3, 4, new RuntimeException()).get("message").toString()).doesNotContain("cached");
    }
}
