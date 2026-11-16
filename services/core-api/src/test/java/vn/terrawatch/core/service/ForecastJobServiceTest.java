package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vn.terrawatch.core.client.AiServiceClient;
import vn.terrawatch.core.entity.ForecastRun;
import vn.terrawatch.core.entity.ForecastRun.JobStatus;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.ForecastRunJpaRepository;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Unit tests: repository, AI client and Redis publisher are mocks. */
class ForecastJobServiceTest {
    private final ForecastRunJpaRepository repo = mock(ForecastRunJpaRepository.class);
    private final AiServiceClient ai = mock(AiServiceClient.class);
    private final EventPublisher events = mock(EventPublisher.class);
    private final ForecastJobService service = new ForecastJobService(repo, ai, events);

    private static ForecastRun withId(ForecastRun run, UUID id) {
        try {
            var f = ForecastRun.class.getDeclaredField("runId");
            f.setAccessible(true);
            f.set(run, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return run;
    }

    private ForecastRun pending(UUID id) {
        ForecastRun run = new ForecastRun();
        run.setUnitId("U1");
        run.setUnitVersion("v1");
        run.setModelVersion("m1");
        run.setThresholdVersion("t1");
        run.setIssuedAt(java.time.OffsetDateTime.now());
        withId(run, id);
        when(repo.findById(id)).thenReturn(Optional.of(run));
        when(repo.save(any(ForecastRun.class))).thenAnswer(c -> c.getArgument(0));
        return run;
    }

    // ---- createJob ----

    @Test
    void createJobPersistsPendingRunValidFor24HoursFromTheHourAndWakesTheWorker() {
        UUID id = UUID.randomUUID();
        when(repo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(repo.saveAndFlush(any(ForecastRun.class))).thenAnswer(c -> withId(c.getArgument(0), id));
        UUID snapshot = UUID.randomUUID();

        ForecastRun run = service.createJob("U1", "v2", snapshot, "m1", "t1");

        assertThat(run.getJobStatus()).isEqualTo(JobStatus.PENDING);
        assertThat(run.getIssuedAt().getMinute()).isZero();
        assertThat(run.getValidFrom()).isEqualTo(run.getIssuedAt());
        assertThat(run.getValidUntil()).isEqualTo(run.getIssuedAt().plusHours(24));
        assertThat(run.getIdempotencyKey()).startsWith("U1|v2|m1|").endsWith("|" + snapshot);
        verify(events).publishEvent("RAINFALL_INPUTS_UPDATED", Map.of("run_id", id.toString(), "unit_id", "U1"));
    }

    @Test
    void createJobWithSameKeyReturnsExistingRunWithoutSavingOrPublishing() {
        ForecastRun existing = withId(new ForecastRun(), UUID.randomUUID());
        when(repo.findByIdempotencyKey(anyString())).thenReturn(Optional.of(existing));

        assertThat(service.createJob("U1", "v1", null, "m1", "t1")).isSameAs(existing);

        verify(repo, never()).saveAndFlush(any());
        verifyNoInteractions(events);
    }

    @Test
    void createJobSurvivesRedisFailure() {
        when(repo.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(repo.saveAndFlush(any(ForecastRun.class))).thenAnswer(c -> withId(c.getArgument(0), UUID.randomUUID()));
        doThrow(new IllegalStateException("redis down")).when(events).publishEvent(anyString(), anyMap());

        assertThat(service.createJob("U1", "v1", null, "m1", "t1").getJobStatus()).isEqualTo(JobStatus.PENDING);
    }

    // ---- executeJob ----

    @Test
    void executeUnknownRunIsRejected() {
        UUID id = UUID.randomUUID();
        when(repo.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.executeJob(id)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining(id.toString());
        verifyNoInteractions(ai, events);
    }

    @Test
    void completedRunIsNotRunAgain() {
        UUID id = UUID.randomUUID();
        ForecastRun run = pending(id);
        run.setJobStatus(JobStatus.COMPLETED);

        assertThat(service.executeJob(id)).isSameAs(run);

        verifyNoInteractions(ai, events);
        verify(repo, never()).save(any());
    }

    @Test
    void runOutOfRetriesIsMarkedFailedWithoutCallingAi() {
        UUID id = UUID.randomUUID();
        ForecastRun run = pending(id);
        run.setRetryCount(3);

        ForecastRun out = service.executeJob(id);

        assertThat(out.getJobStatus()).isEqualTo(JobStatus.FAILED);
        assertThat(out.getLastError()).isEqualTo("Max retries exceeded");
        assertThat(out.getRetryCount()).isEqualTo(3);
        verifyNoInteractions(ai, events);
    }

    @Test
    void aiAnswerIsStoredThenEventIsPublished() {
        UUID id = UUID.randomUUID();
        ForecastRun run = pending(id);
        UUID snapshot = UUID.randomUUID();
        run.setSnapshotId(snapshot);
        Map<String, Object> answer = new HashMap<>();
        answer.put("availability", "available");
        answer.put("probability", 0.42);
        answer.put("experimental_score", 7);
        answer.put("hazard_level", "high");
        when(ai.requestForecast(anyMap())).thenReturn(answer);

        ForecastRun out = service.executeJob(id);

        assertThat(out.getJobStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(out.getProbability()).isEqualTo(0.42);
        assertThat(out.getExperimentalScore()).isEqualTo(7.0);
        assertThat(out.getHazardLevel()).isEqualTo("high");
        assertThat(out.getAvailability()).isEqualTo("available");
        assertThat(out.getRetryCount()).isEqualTo(1);
        assertThat(out.getStartedAt()).isNotNull();
        assertThat(out.getCompletedAt()).isNotNull();

        @SuppressWarnings("unchecked") ArgumentCaptor<Map<String, Object>> req = ArgumentCaptor.forClass(Map.class);
        verify(ai).requestForecast(req.capture());
        assertThat(req.getValue()).containsEntry("snapshot_id", snapshot.toString()).containsEntry("assessment_unit_id", "U1")
            .containsEntry("horizon_hours", 24).containsEntry("model_version", "m1");
        // RUNNING is persisted before the AI call, COMPLETED after it
        org.mockito.InOrder order = org.mockito.Mockito.inOrder(repo, ai, events);
        order.verify(repo).save(run);
        order.verify(ai).requestForecast(anyMap());
        order.verify(repo).save(run);
        order.verify(events).publishEvent("HAZARD_FORECAST_READY",
            Map.of("run_id", id.toString(), "unit_id", "U1", "hazard_level", "high"));
    }

    @Test
    void missingSnapshotIsSentAsEmptyString() {
        UUID id = UUID.randomUUID();
        pending(id);
        when(ai.requestForecast(anyMap())).thenReturn(Map.of());
        service.executeJob(id);
        @SuppressWarnings("unchecked") ArgumentCaptor<Map<String, Object>> req = ArgumentCaptor.forClass(Map.class);
        verify(ai).requestForecast(req.capture());
        assertThat(req.getValue()).containsEntry("snapshot_id", "");
    }

    @Test
    void aiDownIsRecordedAsUnavailableAndNothingIsInvented() {
        UUID id = UUID.randomUUID();
        pending(id);
        when(ai.requestForecast(anyMap())).thenReturn(null);

        ForecastRun out = service.executeJob(id);

        assertThat(out.getJobStatus()).isEqualTo(JobStatus.UNAVAILABLE);
        assertThat(out.getAvailability()).isEqualTo("unavailable");
        assertThat(out.getUnavailabilityReason()).contains("AI service unavailable");
        assertThat(out.getProbability()).isNull();
        assertThat(out.getHazardLevel()).isNull();
        verifyNoInteractions(events);
    }

    @Test
    void aiSayingUnavailableWithReasonMakesRunUnavailableButAvailableWithReasonStaysCompleted() {
        UUID id = UUID.randomUUID();
        pending(id);
        when(ai.requestForecast(anyMap())).thenReturn(Map.of("availability", "unavailable", "unavailability_reason", "no rainfall data"));
        ForecastRun out = service.executeJob(id);
        assertThat(out.getJobStatus()).isEqualTo(JobStatus.UNAVAILABLE);
        assertThat(out.getUnavailabilityReason()).isEqualTo("no rainfall data");

        UUID id2 = UUID.randomUUID();
        pending(id2);
        when(ai.requestForecast(anyMap())).thenReturn(Map.of("unavailability_reason", "partial inputs"));
        ForecastRun out2 = service.executeJob(id2);
        assertThat(out2.getJobStatus()).isEqualTo(JobStatus.COMPLETED);
        assertThat(out2.getAvailability()).isEqualTo("available");
    }

    @Test
    void nonNumericProbabilityAndNonStringHazardAreIgnored() {
        UUID id = UUID.randomUUID();
        pending(id);
        when(ai.requestForecast(anyMap())).thenReturn(Map.of("probability", "high", "hazard_level", 3));
        ForecastRun out = service.executeJob(id);
        assertThat(out.getProbability()).isNull();
        assertThat(out.getHazardLevel()).isNull();
    }

    @Test
    void redisFailureAfterPersistDoesNotLoseTheResult() {
        UUID id = UUID.randomUUID();
        pending(id);
        when(ai.requestForecast(anyMap())).thenReturn(Map.of("hazard_level", "low"));
        doThrow(new IllegalStateException("redis down")).when(events).publishEvent(eq("HAZARD_FORECAST_READY"), anyMap());

        assertThat(service.executeJob(id).getJobStatus()).isEqualTo(JobStatus.COMPLETED);
    }
}
