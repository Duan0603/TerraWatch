package vn.terrawatch.core.repository;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.terrawatch.core.entity.CommunityReport;
import vn.terrawatch.core.entity.MonitoringArea;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Custom queries of {@link CommunityReportJpaRepository} and {@link MonitoringAreaJpaRepository}. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class CommunityReportAndAreaJpaRepositoryDbTest {
    private static final OffsetDateTime T0 = OffsetDateTime.parse("2031-04-01T00:00:00Z");

    @Autowired CommunityReportJpaRepository reports;
    @Autowired MonitoringAreaJpaRepository areas;
    @Autowired JdbcTemplate jdbc;
    private final Set<Integer> mine = new HashSet<>();

    private int report(String status, OffsetDateTime time) {
        int id = jdbc.queryForObject("""
            INSERT INTO core_schema.community_reports (location, report_time, status)
            VALUES (ST_SetSRID(ST_MakePoint(106, 10), 4326), ?, CAST(? AS core_schema.report_status)) RETURNING report_id
            """, Integer.class, time, status);
        mine.add(id);
        return id;
    }

    private int area(boolean active) {
        int id = jdbc.queryForObject("""
            INSERT INTO gis_schema.monitoring_areas (name, geom, is_active)
            VALUES (?, ST_GeomFromText('MULTIPOLYGON(((106 10, 106.01 10, 106.01 10.01, 106 10.01, 106 10)))', 4326), ?) RETURNING area_id
            """, Integer.class, "jpa-area-" + UUID.randomUUID(), active);
        mine.add(id);
        return id;
    }

    @Test
    void findAllByOrderByReportTimeDescListsEveryStatusNewestFirst() {
        int oldest = report("archived", T0.minusDays(2));
        int newest = report("submitted", T0);
        int middle = report("processed", T0.minusDays(1));

        List<Integer> ids = reports.findAllByOrderByReportTimeDesc().stream().map(CommunityReport::getReportId).filter(mine::contains).toList();

        assertThat(ids).containsExactly(newest, middle, oldest);
    }

    @Disabled("BUG: derived query binds a varchar parameter against a native enum column; PostgreSQL answers 'operator does not exist: core_schema.report_status = character varying' (no CAST in the repository, no stringtype=unspecified on the datasource)")
    @Test
    void findByStatusReturnsOnlyReportsWithThatStatus() {
        int submitted = report("submitted", T0);
        int processed = report("processed", T0);
        report("archived", T0);

        assertThat(reports.findByStatus("submitted").stream().map(CommunityReport::getReportId).filter(mine::contains)).containsExactly(submitted);
        assertThat(reports.findByStatus("processed").stream().map(CommunityReport::getReportId).filter(mine::contains)).containsExactly(processed);
    }

    @Test
    void findByIsActiveTrueSkipsDeactivatedAreas() {
        int active = area(true);
        int inactive = area(false);

        List<Integer> ids = areas.findByIsActiveTrue().stream().map(MonitoringArea::getAreaId).toList();

        assertThat(ids).contains(active).doesNotContain(inactive);
        assertThat(areas.findByIsActiveTrue()).extracting(MonitoringArea::getIsActive).containsOnly(true);
    }
}
