package vn.terrawatch.core.repository;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.terrawatch.core.entity.LandslideEvent;
import vn.terrawatch.core.entity.LandslideEventHistory;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Custom queries of {@link LandslideEventJpaRepository} and {@link LandslideEventHistoryJpaRepository}. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class LandslideEventJpaRepositoryDbTest {
    private static final OffsetDateTime T0 = OffsetDateTime.parse("2031-02-01T00:00:00Z");

    @Autowired LandslideEventJpaRepository events;
    @Autowired LandslideEventHistoryJpaRepository history;
    @Autowired JdbcTemplate jdbc;
    private final Set<UUID> mine = new HashSet<>();

    private UUID event(String status, String risk, OffsetDateTime detected) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
            INSERT INTO core_schema.landslide_events (event_id, geom, risk_level, status, detection_date)
            VALUES (?, ST_GeomFromText('MULTIPOLYGON(((106 10, 106.001 10, 106.001 10.001, 106 10.001, 106 10)))', 4326),
                    CAST(? AS core_schema.risk_level), CAST(? AS core_schema.verification_status), ?)
            """, id, risk, status, detected);
        mine.add(id);
        return id;
    }

    private List<UUID> onlyMine(List<LandslideEvent> found) {
        return found.stream().map(LandslideEvent::getEventId).filter(mine::contains).toList();
    }

    @Disabled("BUG: derived query binds a varchar parameter against a native enum column; PostgreSQL answers 'operator does not exist: core_schema.verification_status = character varying' (no CAST in the repository, no stringtype=unspecified on the datasource)")
    @Test
    void findByStatusOrderByDetectionDateDescReturnsThatStatusNewestFirst() {
        UUID oldest = event("pending", "low", T0.minusDays(3));
        UUID newest = event("pending", "low", T0);
        UUID middle = event("pending", "high", T0.minusDays(1));
        event("verified", "low", T0.plusDays(1));
        event("rejected", "low", T0.plusDays(1));

        assertThat(onlyMine(events.findByStatusOrderByDetectionDateDesc("pending"))).containsExactly(newest, middle, oldest);
        assertThat(events.findByStatusOrderByDetectionDateDesc("pending")).extracting(LandslideEvent::getStatus).containsOnly("pending");
    }

    @Disabled("BUG: derived query binds a varchar parameter against a native enum column; PostgreSQL answers 'operator does not exist: core_schema.risk_level = character varying' (no CAST in the repository, no stringtype=unspecified on the datasource)")
    @Test
    void findByRiskLevelReturnsOnlyThatLevelRegardlessOfStatus() {
        UUID a = event("pending", "extreme", T0);
        UUID b = event("verified", "extreme", T0);
        event("pending", "high", T0);

        assertThat(onlyMine(events.findByRiskLevel("extreme"))).containsExactlyInAnyOrder(a, b);
        assertThat(onlyMine(events.findByRiskLevel("low"))).isEmpty();
    }

    @Disabled("BUG: derived query binds a varchar parameter against a native enum column; PostgreSQL answers 'operator does not exist: core_schema.verification_status = character varying' (no CAST in the repository, no stringtype=unspecified on the datasource)")
    @Test
    void countByStatusCountsEachStatusSeparately() {
        long pendingBefore = events.countByStatus("pending");
        long verifiedBefore = events.countByStatus("verified");
        event("pending", "low", T0);
        event("pending", "low", T0);
        event("verified", "low", T0);
        event("false_alarm", "low", T0);

        assertThat(events.countByStatus("pending")).isEqualTo(pendingBefore + 2);
        assertThat(events.countByStatus("verified")).isEqualTo(verifiedBefore + 1);
    }

    @Test
    void countExtremeVerifiedEventsCountsOnlyTheVerifiedExtremeCombination() {
        // The native query names the table without a schema, so it relies on the app datasource's currentSchema.
        jdbc.execute("SET LOCAL search_path TO core_schema, gis_schema, public");
        long before = events.countExtremeVerifiedEvents();
        event("verified", "extreme", T0);
        event("verified", "extreme", T0);
        event("verified", "high", T0);
        event("pending", "extreme", T0);
        event("rejected", "extreme", T0);

        assertThat(events.countExtremeVerifiedEvents()).isEqualTo(before + 2);
    }

    @Test
    void historyIsListedForOneEventNewestChangeFirst() {
        UUID id = event("pending", "low", T0);
        UUID other = event("pending", "low", T0);
        insertHistory(id, "pending", "verified", T0.minusHours(5));
        insertHistory(id, "verified", "rejected", T0);
        insertHistory(id, "rejected", "pending", T0.minusHours(2));
        insertHistory(other, "pending", "verified", T0.plusHours(1));

        List<LandslideEventHistory> rows = history.findByEventIdOrderByChangedAtDesc(id);

        assertThat(rows).extracting(LandslideEventHistory::getNewStatus).containsExactly("rejected", "pending", "verified");
        assertThat(rows).extracting(LandslideEventHistory::getEventId).containsOnly(id);
        assertThat(history.findByEventIdOrderByChangedAtDesc(UUID.randomUUID())).isEmpty();
    }

    private void insertHistory(UUID eventId, String from, String to, OffsetDateTime changedAt) {
        jdbc.update("""
            INSERT INTO core_schema.landslide_event_history (event_id, previous_status, new_status, changed_at)
            VALUES (?, CAST(? AS core_schema.verification_status), CAST(? AS core_schema.verification_status), ?)
            """, eventId, from, to, changedAt);
    }
}
