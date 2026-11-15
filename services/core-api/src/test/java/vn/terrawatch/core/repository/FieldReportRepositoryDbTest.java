package vn.terrawatch.core.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.dto.FieldReportResponse;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** {@link FieldReportRepository}: the idempotent insert, the point round-trip and the per-user listing. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class FieldReportRepositoryDbTest {
    private static final OffsetDateTime OBSERVED = OffsetDateTime.parse("2026-05-04T03:02:01Z");

    private FieldReportRepository reports;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void repository() {
        reports = new FieldReportRepository(jdbc);
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO core_schema.users (user_id, full_name, email, password_hash) VALUES (?, 'Reporter', ?, 'x')",
            id, id + "@field-db.example");
        return id;
    }

    private static CommunityReportRequest request(UUID clientId, double lon, double lat, String description, OffsetDateTime until) {
        return new CommunityReportRequest(clientId, lon, lat, 12.5, description, null, OBSERVED, until);
    }

    @Test
    void insertIfAbsentStoresAPoint4326ReportWithServerSideStatusAndSourceAndReadsItBack() {
        UUID userId = user();
        UUID clientId = UUID.randomUUID();
        OffsetDateTime until = OBSERVED.plusHours(2);

        assertThat(reports.insertIfAbsent(userId, request(clientId, 104.25, 21.5, "crack in road", until), "http://img/1.jpg")).isTrue();

        FieldReportResponse r = reports.findByClientId(userId, clientId);
        assertThat(r.clientReportId()).isEqualTo(clientId.toString());
        assertThat(r.status()).isEqualTo("submitted");
        assertThat(r.longitude()).isEqualTo(104.25);
        assertThat(r.latitude()).isEqualTo(21.5);
        assertThat(r.description()).isEqualTo("crack in road");
        assertThat(r.imageUrl()).isEqualTo("http://img/1.jpg");
        assertThat(OffsetDateTime.parse(r.observedAt()).toInstant()).isEqualTo(OBSERVED.toInstant());
        assertThat(OffsetDateTime.parse(r.observedUntil()).toInstant()).isEqualTo(until.toInstant());
        assertThat(r.reportedAt()).as("server receive time is set by the column default").isNotNull();
        assertThat(jdbc.queryForMap("SELECT source, ST_SRID(location) AS srid, GeometryType(location) AS type, location_accuracy_m FROM core_schema.community_reports WHERE report_id = ?", r.reportId()))
            .containsEntry("source", "mobile").containsEntry("srid", 4326).containsEntry("type", "POINT").containsEntry("location_accuracy_m", 12.5);
    }

    @Test
    void insertIfAbsentStoresNullOptionalFieldsAsNull() {
        UUID userId = user();
        UUID clientId = UUID.randomUUID();

        reports.insertIfAbsent(userId, request(clientId, 105, 20, null, null), null);

        FieldReportResponse r = reports.findByClientId(userId, clientId);
        assertThat(r.description()).isNull();
        assertThat(r.imageUrl()).isNull();
        assertThat(r.observedUntil()).isNull();
    }

    @Test
    void secondInsertWithTheSameUserAndClientIdIsIgnoredAndKeepsTheFirstValues() {
        UUID userId = user();
        UUID clientId = UUID.randomUUID();
        assertThat(reports.insertIfAbsent(userId, request(clientId, 104, 21, "first", null), "http://img/first.jpg")).isTrue();

        assertThat(reports.insertIfAbsent(userId, request(clientId, 109, 11, "second", null), "http://img/second.jpg")).isFalse();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM core_schema.community_reports WHERE client_report_id = ?", Integer.class, clientId)).isEqualTo(1);
        FieldReportResponse r = reports.findByClientId(userId, clientId);
        assertThat(r.description()).isEqualTo("first");
        assertThat(r.longitude()).isEqualTo(104.0);
        assertThat(r.imageUrl()).isEqualTo("http://img/first.jpg");
    }

    @Test
    void theSameClientIdFromAnotherUserIsAnIndependentReport() {
        UUID a = user();
        UUID b = user();
        UUID clientId = UUID.randomUUID();

        assertThat(reports.insertIfAbsent(a, request(clientId, 104, 21, "from a", null), null)).isTrue();
        assertThat(reports.insertIfAbsent(b, request(clientId, 105, 22, "from b", null), null)).isTrue();

        assertThat(reports.findByClientId(a, clientId).description()).isEqualTo("from a");
        assertThat(reports.findByClientId(b, clientId).description()).isEqualTo("from b");
    }

    @Test
    void findByClientIdIsScopedToTheUserAndFailsForAnUnknownPair() {
        UUID owner = user();
        UUID stranger = user();
        UUID clientId = UUID.randomUUID();
        reports.insertIfAbsent(owner, request(clientId, 104, 21, "mine", null), null);

        assertThatThrownBy(() -> reports.findByClientId(stranger, clientId)).isInstanceOf(EmptyResultDataAccessException.class);
        assertThatThrownBy(() -> reports.findByClientId(owner, UUID.randomUUID())).isInstanceOf(EmptyResultDataAccessException.class);
    }

    @Test
    void listByUserReturnsOnlyThatUsersReportsNewestReceivedFirstAndEmptyForNone() {
        UUID owner = user();
        UUID other = user();
        UUID c1 = UUID.randomUUID(), c2 = UUID.randomUUID(), c3 = UUID.randomUUID();
        reports.insertIfAbsent(owner, request(c1, 104, 21, "oldest", null), null);
        reports.insertIfAbsent(owner, request(c2, 104, 21, "newest", null), null);
        reports.insertIfAbsent(owner, request(c3, 104, 21, "middle", null), null);
        reports.insertIfAbsent(other, request(UUID.randomUUID(), 104, 21, "not mine", null), null);
        // report_time defaults to the transaction start, so all rows would tie: pin distinct receive times.
        jdbc.update("UPDATE core_schema.community_reports SET report_time = '2026-01-01T00:00:00Z' WHERE client_report_id = ?", c1);
        jdbc.update("UPDATE core_schema.community_reports SET report_time = '2026-01-03T00:00:00Z' WHERE client_report_id = ?", c2);
        jdbc.update("UPDATE core_schema.community_reports SET report_time = '2026-01-02T00:00:00Z' WHERE client_report_id = ?", c3);

        List<FieldReportResponse> list = reports.listByUser(owner);

        assertThat(list).extracting(FieldReportResponse::description).containsExactly("newest", "middle", "oldest");
        assertThat(reports.listByUser(user())).isEmpty();
    }

    @Test
    void anOutOfRangeLongitudeIsNotRejectedByPostgisItself() {
        // Range checks live in the request DTO; the SQL stores whatever point it is given. Documents that boundary.
        UUID userId = user();
        UUID clientId = UUID.randomUUID();
        assertThat(reports.insertIfAbsent(userId, request(clientId, 200, 95, "off-globe", null), null)).isTrue();
        assertThat(reports.findByClientId(userId, clientId).longitude()).isEqualTo(200.0);
    }

    @Test
    void insertForAnUnknownUserViolatesTheForeignKey() {
        UUID ghost = UUID.randomUUID();
        CommunityReportRequest req = request(UUID.randomUUID(), 104, 21, "x", null);
        assertThatThrownBy(() -> reports.insertIfAbsent(ghost, req, null)).isInstanceOf(DataAccessException.class);
    }
}
