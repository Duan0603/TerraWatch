package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import vn.terrawatch.core.entity.ForecastRun;
import vn.terrawatch.core.repository.ForecastRunJpaRepository;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/** The recovery poller re-runs jobs left pending/running; repository, job service and live hub are mocked. */
class ForecastRecoveryPollerTest {
    private static final int STUCK_MINUTES = 7;

    private final ForecastRunJpaRepository repo = mock(ForecastRunJpaRepository.class);
    private final ForecastJobService jobs = mock(ForecastJobService.class);
    private final LiveUpdateHub live = mock(LiveUpdateHub.class);
    private final ForecastRecoveryPoller poller = new ForecastRecoveryPoller(repo, jobs, live, STUCK_MINUTES);

    private static ForecastRun run(UUID id) {
        ForecastRun run = mock(ForecastRun.class);
        when(run.getRunId()).thenReturn(id);
        return run;
    }

    @Test
    void asksForPendingAndRunningJobsOlderThanTheConfiguredTimeout() {
        when(repo.findStuckJobs(anyList(), any())).thenReturn(List.of());
        OffsetDateTime before = OffsetDateTime.now();

        poller.pollStuckJobs();

        ArgumentCaptor<List<String>> statuses = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<OffsetDateTime> cutoff = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repo).findStuckJobs(statuses.capture(), cutoff.capture());
        assertThat(statuses.getValue()).containsExactlyInAnyOrder("pending", "running");
        assertThat(cutoff.getValue()).isBetween(before.minusMinutes(STUCK_MINUTES), OffsetDateTime.now().minusMinutes(STUCK_MINUTES));
    }

    @Test
    void nothingStuckMeansNoJobIsRunAndNobodyIsNotified() {
        when(repo.findStuckJobs(anyList(), any())).thenReturn(List.of());

        poller.pollStuckJobs();

        verifyNoInteractions(jobs, live);
    }

    @Test
    void everyStuckJobIsExecutedOnceInOrderAndTheQueueViewIsToldAfterEach() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<ForecastRun> stuck = List.of(run(first), run(second));
        when(repo.findStuckJobs(anyList(), any())).thenReturn(stuck);

        poller.pollStuckJobs();

        InOrder order = inOrder(jobs, live);
        order.verify(jobs).executeJob(first);
        order.verify(live).publish("queue");
        order.verify(jobs).executeJob(second);
        order.verify(live).publish("queue");
        verifyNoMoreInteractions(jobs, live);
    }

    @Test
    void aJobThatFailsIsSkippedWithoutNotifyingAndTheRestStillRun() {
        UUID broken = UUID.randomUUID();
        UUID healthy = UUID.randomUUID();
        List<ForecastRun> stuck = List.of(run(broken), run(healthy));
        when(repo.findStuckJobs(anyList(), any())).thenReturn(stuck);
        doThrow(new IllegalStateException("AI down")).when(jobs).executeJob(broken);

        poller.pollStuckJobs(); // must not throw

        verify(jobs).executeJob(broken);
        verify(jobs).executeJob(healthy);
        verify(live, org.mockito.Mockito.times(1)).publish("queue");
    }

    @Test
    void aFailureOfTheLiveNotificationAlsoDoesNotStopTheNextJob() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        List<ForecastRun> stuck = List.of(run(first), run(second));
        when(repo.findStuckJobs(anyList(), any())).thenReturn(stuck);
        doThrow(new IllegalStateException("hub closed")).when(live).publish(eq("queue"));

        poller.pollStuckJobs();

        verify(jobs).executeJob(first);
        verify(jobs).executeJob(second);
    }

    @Test
    void theTimeoutIsInjectedNotHardCoded() {
        ForecastRecoveryPoller strict = new ForecastRecoveryPoller(repo, jobs, live, 1);
        when(repo.findStuckJobs(anyList(), any())).thenReturn(List.of());

        strict.pollStuckJobs();

        ArgumentCaptor<OffsetDateTime> cutoff = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repo).findStuckJobs(anyList(), cutoff.capture());
        assertThat(Duration.between(cutoff.getValue(), OffsetDateTime.now())).isBetween(Duration.ofSeconds(59), Duration.ofSeconds(70));
        verify(jobs, never()).executeJob(any());
    }
}
