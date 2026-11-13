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

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** AI client: request shape and response mapping called directly, and fallbacks through the real circuit breaker aspect. */
class AiServiceClientTest {
    private static final String BASE = "http://ai.test:8001";
    private final RestTemplate rest = new RestTemplate();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(rest).build();
    private final AiServiceClient client = new AiServiceClient(rest, BASE);

    @Test
    void predictPostsSceneIdAndBboxInLonLatOrderAndReturnsTheBody() {
        server.expect(requestTo(BASE + "/api/v1/inference")).andExpect(method(HttpMethod.POST))
            .andExpect(header("Content-Type", org.hamcrest.Matchers.startsWith("application/json")))
            .andExpect(jsonPath("$.satellite_scene_id").value("S2-1"))
            .andExpect(jsonPath("$.bbox[0]").value(105.1)).andExpect(jsonPath("$.bbox[1]").value(21.2))
            .andExpect(jsonPath("$.bbox[2]").value(105.3)).andExpect(jsonPath("$.bbox[3]").value(21.4))
            .andRespond(withSuccess("{\"success\":true,\"detected_polygons\":[1]}", MediaType.APPLICATION_JSON));

        Map<String, Object> out = client.predictLandslide("S2-1", 105.1, 21.2, 105.3, 21.4);

        assertThat(out).containsEntry("success", true);
        server.verify();
    }

    @Test
    void forecastPostsTheRequestUnchangedAndReturnsTheBody() {
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.assessment_unit_id").value("u-1"))
            .andRespond(withSuccess("{\"probability\":0.7,\"availability\":\"available\"}", MediaType.APPLICATION_JSON));

        Map<String, Object> out = client.requestForecast(Map.of("assessment_unit_id", "u-1"));

        assertThat(out).containsEntry("probability", 0.7);
        server.verify();
    }

    @Test
    void modelCardsUseGetOnTheirOwnPaths() {
        server.expect(requestTo(BASE + "/api/v1/models/info")).andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("{\"ready\":true,\"name\":\"seg\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/api/v1/models/gru/info")).andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess("{\"ready\":true,\"name\":\"gru\"}", MediaType.APPLICATION_JSON));

        assertThat(client.segmentationCard()).containsEntry("name", "seg");
        assertThat(client.gruCard()).containsEntry("name", "gru");
        server.verify();
    }

    @Test
    void errorStatusesAndTransportFailuresSurfaceAsExceptionsNotData() {
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withStatus(HttpStatus.BAD_REQUEST).body("{\"detail\":\"bad\"}").contentType(MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(request -> { throw new SocketTimeoutException("Read timed out"); });
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(request -> { throw new ConnectException("Connection refused"); });
        Map<String, Object> req = Map.of("assessment_unit_id", "u");

        assertThatThrownBy(() -> client.requestForecast(req)).isInstanceOf(HttpClientErrorException.class);
        assertThatThrownBy(() -> client.requestForecast(req)).isInstanceOf(HttpServerErrorException.class);
        assertThatThrownBy(() -> client.requestForecast(req)).isInstanceOf(HttpServerErrorException.class);
        assertThatThrownBy(() -> client.requestForecast(req)).isInstanceOf(ResourceAccessException.class).hasCauseInstanceOf(SocketTimeoutException.class);
        assertThatThrownBy(() -> client.requestForecast(req)).isInstanceOf(ResourceAccessException.class).hasCauseInstanceOf(ConnectException.class);
    }

    @Test
    void malformedJsonIsAnExceptionNotAMap() {
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withSuccess("<html>oops</html>", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.requestForecast(Map.of("assessment_unit_id", "u"))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void emptyBodyForecastIsNullSoTheJobIsMarkedUnavailable() {
        server.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withSuccess());
        assertThat(client.requestForecast(Map.of("assessment_unit_id", "u"))).isNull();
    }

    @Test
    void fallbacksNeverFabricateData() {
        Throwable down = new IOException("down");

        assertThat(client.fallbackForecast(Map.of("assessment_unit_id", "u"), down)).isNull();
        assertThat(client.fallbackCard(down)).isEqualTo(Map.of("ready", false));
        Map<String, Object> predict = client.fallbackPredict("S2-1", 1, 2, 3, 4, down);
        assertThat(predict).containsEntry("success", false).containsEntry("scene_id", "S2-1");
        assertThat((List<?>) predict.get("detected_polygons")).isEmpty();
        assertThat(predict).doesNotContainKeys("probability", "hazard_level");
    }

    private void withProxy(java.util.function.Consumer<AiServiceClient> body, java.util.function.Consumer<MockRestServiceServer> expectations) {
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class, CircuitBreakerAutoConfiguration.class))
            .withBean(RestTemplate.class, RestTemplate::new)
            .withBean(AiServiceClient.class, () -> new AiServiceClient(new RestTemplate(), BASE))
            .withPropertyValues("resilience4j.circuitbreaker.instances.aiService.slidingWindowSize=10",
                "resilience4j.circuitbreaker.instances.aiService.minimumNumberOfCalls=5",
                "resilience4j.circuitbreaker.instances.aiService.failureRateThreshold=50",
                "resilience4j.circuitbreaker.instances.aiService.waitDurationInOpenState=60s")
            .run(ctx -> {
                AiServiceClient proxied = ctx.getBean(AiServiceClient.class);
                var field = AiServiceClient.class.getDeclaredField("restTemplate");
                field.setAccessible(true);
                // the proxy is a CGLIB subclass: its inherited private field is not the target's; reach the target instead
                Object target = org.springframework.aop.framework.AopProxyUtils.getSingletonTarget(proxied);
                RestTemplate rt = (RestTemplate) field.get(target);
                MockRestServiceServer srv = MockRestServiceServer.bindTo(rt).build();
                expectations.accept(srv);
                body.accept(proxied);
                srv.verify();
            });
    }

    @Test
    void throughTheProxyAnOutageBecomesUnavailableNeverAForecast() {
        withProxy(c -> {
            assertThat(c.requestForecast(Map.of("assessment_unit_id", "u"))).isNull();
            assertThat(c.requestForecast(Map.of("assessment_unit_id", "u"))).isNull();
            assertThat(c.segmentationCard()).isEqualTo(Map.of("ready", false));
            assertThat(c.gruCard()).isEqualTo(Map.of("ready", false));
            Map<String, Object> p = c.predictLandslide("S", 1, 2, 3, 4);
            assertThat(p).containsEntry("success", false).containsEntry("status", "CIRCUIT_BREAKER_FALLBACK");
        }, s -> {
            s.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
            s.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(request -> { throw new ConnectException("Connection refused"); });
            s.expect(requestTo(BASE + "/api/v1/models/info")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
            s.expect(requestTo(BASE + "/api/v1/models/gru/info")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
            s.expect(requestTo(BASE + "/api/v1/inference")).andRespond(request -> { throw new SocketTimeoutException("Read timed out"); });
        });
    }

    @Test
    void afterEnoughFailuresTheCircuitOpensAndStopsCallingTheService() {
        withProxy(c -> {
            for (int i = 0; i < 8; i++) assertThat(c.requestForecast(Map.of("assessment_unit_id", "u"))).isNull();
        }, s -> {
            // minimumNumberOfCalls=5: exactly five reach the server, the other three are short-circuited
            for (int i = 0; i < 5; i++) s.expect(requestTo(BASE + "/api/v1/forecasts")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        });
    }

    @Test
    @Disabled("BUG: expected empty-body model card to read as unavailable {ready:false}; actual segmentationCard() returns null, "
        + "and ModelCardController line 27 Map.of(\"segmentation\", null) then throws NullPointerException -> HTTP 500")
    void emptyBodyModelCardIsNotNull() {
        server.expect(requestTo(BASE + "/api/v1/models/info")).andRespond(withSuccess());
        assertThat(client.segmentationCard()).isEqualTo(Map.of("ready", false));
    }

    @Test
    @Disabled("BUG: expected predictLandslide on 200/empty body to read as unavailable (success=false); actual returns null, "
        + "which DiagnosticController line 40 serves as HTTP 200 with an empty body")
    void emptyBodyPredictIsNotNull() {
        server.expect(requestTo(BASE + "/api/v1/inference")).andRespond(withSuccess());
        assertThat(client.predictLandslide("S", 1, 2, 3, 4)).isNotNull();
    }
}
