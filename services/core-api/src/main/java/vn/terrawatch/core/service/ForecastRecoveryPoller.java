package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vn.terrawatch.core.entity.ForecastRun;
import vn.terrawatch.core.repository.ForecastRunJpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Story 4.1: Recovery poller — resumes stuck PENDING/RUNNING jobs after restart or lost Redis.
 */
@Service
public class ForecastRecoveryPoller {

    private static final Logger log = LoggerFactory.getLogger(ForecastRecoveryPoller.class);

    private final ForecastRunJpaRepository repo;
    private final ForecastJobService jobService;
    private final int stuckTimeoutMinutes;
    private final LiveUpdateHub live;

    public ForecastRecoveryPoller(ForecastRunJpaRepository repo, ForecastJobService jobService,
                                  LiveUpdateHub live,
                                  @Value("${forecast.recovery.stuck-timeout-minutes:5}") int stuckTimeoutMinutes) {
        this.live = live;
        this.repo = repo;
        this.jobService = jobService;
        this.stuckTimeoutMinutes = stuckTimeoutMinutes;
    }

    @Scheduled(fixedDelayString = "${forecast.recovery.poll-interval-ms:60000}")
    public void pollStuckJobs() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(stuckTimeoutMinutes);
        List<ForecastRun> stuck = repo.findStuckJobs(List.of("pending", "running"), cutoff);

        if (stuck.isEmpty()) return;

        log.info("Recovery poller found {} stuck jobs (older than {} min)", stuck.size(), stuckTimeoutMinutes);
        for (ForecastRun run : stuck) {
            try {
                jobService.executeJob(run.getRunId());
                live.publish("queue"); // Story 4.35
            } catch (Exception e) {
                log.error("Recovery failed for job {}: {}", run.getRunId(), e.getMessage());
            }
        }
    }
}
