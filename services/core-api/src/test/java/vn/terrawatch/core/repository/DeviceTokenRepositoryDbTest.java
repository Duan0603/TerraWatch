package vn.terrawatch.core.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** {@link DeviceTokenRepository}: the upsert that moves a shared phone between accounts, and the two delete paths. */
@DataJpaTest(showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class DeviceTokenRepositoryDbTest {
    private DeviceTokenRepository tokens;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void repository() {
        tokens = new DeviceTokenRepository(jdbc);
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO core_schema.users (user_id, full_name, email, password_hash) VALUES (?, 'U', ?, 'x')", id, id + "@device-db.example");
        return id;
    }

    private static String token() {
        return "tok-" + UUID.randomUUID();
    }

    private List<Map<String, Object>> rows(String fcmToken) {
        return jdbc.queryForList("SELECT user_id, device_type, registered_at FROM core_schema.device_tokens WHERE fcm_token = ?", fcmToken);
    }

    @Test
    void registerInsertsOneRowForTheUser() {
        UUID userId = user();
        String t = token();

        tokens.register(userId, t, "ios");

        assertThat(rows(t)).singleElement().satisfies(r ->
            assertThat(r).containsEntry("user_id", userId).containsEntry("device_type", "ios"));
    }

    @Test
    void registeringAnExistingTokenForAnotherUserMovesItAndRefreshesTypeAndTimestamp() {
        UUID first = user();
        UUID second = user();
        String t = token();
        tokens.register(first, t, "android");
        jdbc.update("UPDATE core_schema.device_tokens SET registered_at = ? WHERE fcm_token = ?", OffsetDateTime.parse("2020-01-01T00:00:00Z"), t);

        tokens.register(second, t, "ios");

        assertThat(rows(t)).hasSize(1);
        Map<String, Object> row = rows(t).get(0);
        assertThat(row).containsEntry("user_id", second).containsEntry("device_type", "ios");
        assertThat(jdbc.queryForObject("SELECT registered_at > '2020-01-01T00:00:00Z' FROM core_schema.device_tokens WHERE fcm_token = ?", Boolean.class, t)).isTrue();
    }

    @Test
    void registeringTheSameTokenAndUserTwiceKeepsASingleRow() {
        UUID userId = user();
        String t = token();
        tokens.register(userId, t, "android");
        tokens.register(userId, t, "android");
        assertThat(rows(t)).hasSize(1);
    }

    @Test
    void registerForAnUnknownUserViolatesTheForeignKey() {
        UUID ghost = UUID.randomUUID();
        String t = token();
        assertThatThrownBy(() -> tokens.register(ghost, t, "android")).isInstanceOf(DataAccessException.class);
    }

    @Test
    void removeDeletesOnlyTheCallersOwnToken() {
        UUID owner = user();
        UUID stranger = user();
        String t = token();
        String keep = token();
        tokens.register(owner, t, "android");
        tokens.register(owner, keep, "android");

        tokens.remove(stranger, t);
        assertThat(rows(t)).as("another user cannot remove it").hasSize(1);

        tokens.remove(owner, t);
        assertThat(rows(t)).isEmpty();
        assertThat(rows(keep)).as("the owner's other phone stays").hasSize(1);
    }

    @Test
    void forgetDeletesTheTokenWhoeverOwnsItAndIgnoresUnknownTokens() {
        UUID owner = user();
        String t = token();
        String other = token();
        tokens.register(owner, t, "android");
        tokens.register(owner, other, "android");

        tokens.forget(t);
        tokens.forget(token());

        assertThat(rows(t)).isEmpty();
        assertThat(rows(other)).hasSize(1);
    }
}
