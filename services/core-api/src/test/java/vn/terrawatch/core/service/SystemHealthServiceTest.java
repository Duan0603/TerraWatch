package vn.terrawatch.core.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Unit tests: JDBC and Redis are mocks; AI and GIS are throw-away local HTTP servers so the real timeout/parse code runs. */
class SystemHealthServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    private HttpServer ai;
    private HttpServer gis;

    @AfterEach
    void stop() {
        if (ai != null) ai.stop(0);
        if (gis != null) gis.stop(0);
    }

    private static HttpServer server(int status, String body) throws Exception {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s.createContext("/health", ex -> {
            byte[] b = body.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(status, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.start();
        return s;
    }

    private static String url(HttpServer s) {
        return "http://127.0.0.1:" + s.getAddress().getPort();
    }

    private SystemHealthService service() {
        return new SystemHealthService(jdbc, redis, url(ai), url(gis));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> component(Map<String, Object> report, String key) {
        return ((List<Map<String, Object>>) report.get("components")).stream().filter(c -> key.equals(c.get("key"))).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> freshness(Map<String, Object> report, String key) {
        return ((List<Map<String, Object>>) report.get("freshness")).stream().filter(c -> key.equals(c.get("key"))).findFirst().orElseThrow();
    }

    @Test
    void everyComponentOkWhenAllProbesAnswer() throws Exception {
        ai = server(200, "{\"model_ready\":true}");
        gis = server(200, "{\"status\":\"ok\"}");
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        when(redis.execute(any(RedisCallback.class))).thenReturn("PONG");

        Map<String, Object> report = service().report();

        assertThat(report.get("components")).asList().hasSize(4);
        for (String key : List.of("db", "redis", "ai", "gis")) {
            assertThat(component(report, key)).containsEntry("status", "ok").containsEntry("detail", "Hoạt động");
            assertThat((Long) component(report, key).get("latencyMs")).isGreaterThanOrEqualTo(0L);
        }
        assertThat(Instant.parse((String) report.get("checkedAt"))).isBefore(Instant.now().plusSeconds(1));
    }

    @Test
    void aiRunningWithoutModelIsDegradedNotDown() throws Exception {
        ai = server(200, "{\"model_ready\":false}");
        gis = server(200, "{}");
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);

        Map<String, Object> report = service().report();

        assertThat(component(report, "ai")).containsEntry("status", "degraded");
        assertThat(component(report, "gis")).containsEntry("status", "ok");
    }

    @Test
    void failingProbesAreDownAndTheMessageLeaksNoHostOrStackTrace() throws Exception {
        ai = server(500, "{\"error\":\"boom\"}");
        gis = server(200, "{}");
        int deadPort = gis.getAddress().getPort();
        gis.stop(0);
        gis = null;
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("jdbc:postgresql://secret-host:5432/db refused"));
        when(redis.execute(any(RedisCallback.class))).thenThrow(new IllegalStateException("redis://secret-host"));

        Map<String, Object> report = new SystemHealthService(jdbc, redis, url(ai), "http://127.0.0.1:" + deadPort).report();

        for (String key : List.of("db", "redis", "ai", "gis")) {
            assertThat(component(report, key)).containsEntry("status", "down").containsEntry("detail", "Không kết nối được");
            assertThat(component(report, key).toString()).doesNotContain("secret-host");
        }
    }

    @Test
    void oneFailingComponentDoesNotStopTheOthersFromBeingChecked() throws Exception {
        ai = server(200, "{}");
        gis = server(200, "{}");
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenThrow(new IllegalStateException("db down"));
        when(redis.execute(any(RedisCallback.class))).thenReturn("PONG");

        Map<String, Object> report = service().report();

        assertThat(component(report, "db")).containsEntry("status", "down");
        assertThat(component(report, "redis")).containsEntry("status", "ok");
        assertThat(component(report, "ai")).containsEntry("status", "ok");
    }

    @Test
    void freshnessReportsLatestTimestampAndAgeAndNullWhenNoDataOrTableMissing() throws Exception {
        ai = server(200, "{}");
        gis = server(200, "{}");
        Instant twoHoursAgo = Instant.now().minusSeconds(2 * 3600 + 30);
        when(jdbc.queryForObject(contains("rainfall_observations"), eq(Timestamp.class))).thenReturn(Timestamp.from(twoHoursAgo));
        when(jdbc.queryForObject(contains("rainfall_forecasts"), eq(Timestamp.class))).thenReturn(null);
        when(jdbc.queryForObject(contains("feature_snapshots"), eq(Timestamp.class))).thenThrow(new IllegalStateException("relation does not exist"));

        Map<String, Object> report = service().report();

        assertThat(report.get("freshness")).asList().hasSize(4);
        Map<String, Object> observed = freshness(report, "rainObserved");
        assertThat(observed.get("latest")).isEqualTo(twoHoursAgo.toString());
        assertThat((Long) observed.get("ageMinutes")).isBetween(120L, 122L);
        for (String key : List.of("rainForecast", "snapshot", "forecastRun")) {
            assertThat(freshness(report, key)).containsEntry("latest", null).containsEntry("ageMinutes", null);
        }
    }
}
