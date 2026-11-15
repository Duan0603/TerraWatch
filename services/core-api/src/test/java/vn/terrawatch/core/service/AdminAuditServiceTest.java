package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** AdminAuditService with the JdbcTemplate mocked: the failure and argument rules that a real database would hide. */
class AdminAuditServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AdminAuditService audit = new AdminAuditService(jdbc);

    @Test
    void aFailingInsertNeverReachesTheCallerBecauseTheAdminActionAlreadySucceeded() {
        when(jdbc.update(anyString(), any(Object[].class))).thenThrow(new DataAccessResourceFailureException("db gone"));

        assertThatCode(() -> audit.record(UUID.randomUUID(), "USER_LOCK", "user", "1", "a@b.c", "x")).doesNotThrowAnyException();
    }

    @Test
    void recordPassesTheActorTwiceOnceForTheEmailLookupAndTheFieldsInColumnOrder() {
        UUID actor = UUID.randomUUID();

        audit.record(actor, "BROADCAST_SEND", "broadcast", "id-1", "label", "detail");

        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(anyString(), args.capture());
        assertThat(args.getValue()).containsExactly(actor, actor, "BROADCAST_SEND", "broadcast", "id-1", "label", "detail");
    }

    @Test
    void listClampsTheLimitIntoOneToFiveHundredBeforeQuerying() {
        for (int[] pair : new int[][]{{Integer.MIN_VALUE, 1}, {-1, 1}, {0, 1}, {1, 1}, {200, 200}, {500, 500}, {501, 500}, {Integer.MAX_VALUE, 500}}) {
            audit.list(pair[0]);
            verify(jdbc).query(anyString(), any(RowMapper.class), eq(pair[1]));
            org.mockito.Mockito.clearInvocations(jdbc);
        }
    }
}
