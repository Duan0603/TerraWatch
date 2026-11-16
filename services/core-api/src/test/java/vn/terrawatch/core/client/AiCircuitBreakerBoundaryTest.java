package vn.terrawatch.core.client;

import io.github.resilience4j.springboot3.circuitbreaker.autoconfigure.CircuitBreakerAutoConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.aop.AopAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayDeque;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Circuit breaker boundaries of the AI client (BL-FJOB-005..008), with the values of application.yml (window of 10 calls,
 * at least 5 calls, 50 percent failures, 5 seconds open). AiServiceClientTest only shows 5 of 5 failures open the circuit.
 */
class AiCircuitBreakerBoundaryTest {
    private static final String BASE = "http://ai.test:8001";
    private static final String FORECASTS = BASE + "/api/v1/forecasts";
    private static final Map<String, Object> REQUEST = Map.of("assessment_unit_id", "u");

    /** The fake AI: answers each request that reaches it from {@link #replies} and counts them. */
    private final Queue<Boolean> replies = new ArrayDeque<>();
    private final AtomicInteger served = new AtomicInteger();

    /** Runs the body against the real (proxied) client with the production circuit breaker values. */
    private void withBreaker(java.util.function.Consumer<AiServiceClient> body) {
        replies.clear();
        served.set(0);
        new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(AopAutoConfiguration.class, CircuitBreakerAutoConfiguration.class))
            .withBean(AiServiceClient.class, () -> new AiServiceClient(new RestTemplate(), BASE))
            .withPropertyValues("resilience4j.circuitbreaker.instances.aiService.slidingWindowType=COUNT_BASED",
                "resilience4j.circuitbreaker.instances.aiService.slidingWindowSize=10",
                "resilience4j.circuitbreaker.instances.aiService.minimumNumberOfCalls=5",
                "resilience4j.circuitbreaker.instances.aiService.failureRateThreshold=50",
                "resilience4j.circuitbreaker.instances.aiService.waitDurationInOpenState=5000ms",
                "resilience4j.circuitbreaker.instances.aiService.permittedNumberOfCallsInHalfOpenState=3",
                "resilience4j.circuitbreaker.instances.aiService.automaticTransitionFromOpenToHalfOpenEnabled=true")
            .run(ctx -> {
                AiServiceClient proxied = ctx.getBean(AiServiceClient.class);
                var field = AiServiceClient.class.getDeclaredField("restTemplate");
                field.setAccessible(true);
                RestTemplate rt = (RestTemplate) field.get(org.springframework.aop.framework.AopProxyUtils.getSingletonTarget(proxied));
                MockRestServiceServer.bindTo(rt).build().expect(ExpectedCount.manyTimes(), requestTo(FORECASTS)).andRespond(request -> {
                    served.incrementAndGet();
                    return Boolean.TRUE.equals(replies.poll())
                        ? withSuccess("{\"availability\":\"available\"}", org.springframework.http.MediaType.APPLICATION_JSON).createResponse(request)
                        : withStatus(HttpStatus.INTERNAL_SERVER_ERROR).createResponse(request);
                });
                body.accept(proxied);
            });
    }

    /** Sends calls the fake AI answers ok or with a 500, in that order. */
    private void sendCalls(AiServiceClient client, int ok, int failed) {
        for (int i = 0; i < ok; i++) { replies.add(true); client.requestForecast(REQUEST); }
        for (int i = 0; i < failed; i++) { replies.add(false); client.requestForecast(REQUEST); }
    }

    @Test
    void fourFailuresInTenCallsKeepTheCircuitClosedFiveOpenIt() {
        // BL-FJOB-005: 6 ok + 4 failed = 40 percent: the 11th call still reaches the service
        withBreaker(client -> {
            sendCalls(client, 6, 4);
            replies.add(true);
            assertThat(client.requestForecast(REQUEST)).containsEntry("availability", "available");
            assertThat(served.get()).isEqualTo(11);
        });
        // BL-FJOB-006: 5 ok + 5 failed = 50 percent: the next call never reaches the service and answers the fallback (null)
        withBreaker(client -> {
            sendCalls(client, 5, 5);
            replies.add(true);
            assertThat(client.requestForecast(REQUEST)).isNull();
            assertThat(served.get()).as("the 11th call was cut off").isEqualTo(10);
        });
    }

    @Test
    void anOpenCircuitCutsCallsAt4SecondsAndLetsATrialThroughAt6Seconds() {
        withBreaker(client -> {
            sendCalls(client, 0, 5);
            long opened = System.nanoTime();
            // BL-FJOB-007: 4 seconds after opening, still cut off, no request is made
            sleepUntil(opened, 4_000);
            replies.add(true);
            assertThat(client.requestForecast(REQUEST)).isNull();
            assertThat(served.get()).isEqualTo(5);
            // BL-FJOB-008: 6 seconds after opening the call is tried again
            sleepUntil(opened, 6_000);
            assertThat(client.requestForecast(REQUEST)).containsEntry("availability", "available");
            assertThat(served.get()).isEqualTo(6);
        });
    }

    private static void sleepUntil(long startNanos, long millis) {
        try {
            long left = millis - (System.nanoTime() - startNanos) / 1_000_000;
            if (left > 0) Thread.sleep(left);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
