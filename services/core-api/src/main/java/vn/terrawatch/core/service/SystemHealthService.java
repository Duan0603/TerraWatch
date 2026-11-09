package vn.terrawatch.core.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

/** Story 4.26: one admin-only snapshot of "is every part alive" and "how fresh is the data". */
@Service
public class SystemHealthService {

    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    private final String aiUrl;
    private final String gisUrl;
    private final RestTemplate http;

    public SystemHealthService(JdbcTemplate jdbc, StringRedisTemplate redis,
                               @Value("${services.ai.url}") String aiUrl,
                               @Value("${services.gis.url}") String gisUrl) {
        this.jdbc = jdbc;
        this.redis = redis;
        this.aiUrl = aiUrl;
        this.gisUrl = gisUrl;
        // Short timeouts: a hanging service must show as "down" quickly, not freeze the panel.
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(2).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(3).toMillis());
        this.http = new RestTemplate(factory);
    }

    public Map<String, Object> report() {
        List<Map<String, Object>> components = List.of(
            check("db", "PostgreSQL / PostGIS", () -> jdbc.queryForObject("SELECT 1", Integer.class)),
            check("redis", "Redis (kênh sự kiện)", () -> redis.execute((RedisCallback<String>) c -> c.ping())),
            check("ai", "AI service", () -> http.getForObject(aiUrl + "/health", Map.class)),
            check("gis", "GIS service", () -> http.getForObject(gisUrl + "/health", Map.class)));
        List<Map<String, Object>> freshness = List.of(
            fresh("rainObserved", "Mưa quan trắc (lần nạp gần nhất)", "SELECT MAX(ingested_at) FROM gis_schema.rainfall_observations"),
            fresh("rainForecast", "Mưa dự báo (lần nạp gần nhất)", "SELECT MAX(ingested_at) FROM gis_schema.rainfall_forecasts"),
            fresh("snapshot", "Bộ đặc trưng cho AI", "SELECT MAX(created_at) FROM gis_schema.feature_snapshots"),
            fresh("forecastRun", "Dự báo sạt lở (lần chạy gần nhất)", "SELECT MAX(created_at) FROM core_schema.forecast_runs"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("checkedAt", Instant.now().toString());
        out.put("components", components);
        out.put("freshness", freshness);
        return out;
    }

    private Map<String, Object> check(String key, String label, Callable<Object> probe) {
        long t0 = System.nanoTime();
        String status = "ok";
        String detail = "Hoạt động";
        try {
            Object r = probe.call();
            if (r instanceof Map<?, ?> m && Boolean.FALSE.equals(m.get("model_ready"))) {
                status = "degraded";
                detail = "Dịch vụ chạy nhưng mô hình chưa sẵn sàng";
            }
        } catch (Exception e) {
            status = "down";
            detail = "Không kết nối được"; // no host names or stack traces for the browser
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("label", label);
        m.put("status", status);
        m.put("detail", detail);
        m.put("latencyMs", (System.nanoTime() - t0) / 1_000_000);
        return m;
    }

    private Map<String, Object> fresh(String key, String label, String sql) {
        Instant latest = null;
        try {
            Timestamp ts = jdbc.queryForObject(sql, Timestamp.class);
            if (ts != null) latest = ts.toInstant();
        } catch (Exception ignored) {
            // table missing or unreadable: reported as "no data"
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("label", label);
        m.put("latest", latest == null ? null : latest.toString());
        m.put("ageMinutes", latest == null ? null : Duration.between(latest, Instant.now()).toMinutes());
        return m;
    }
}
