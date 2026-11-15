package vn.terrawatch.core.controller;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.CreateForecastJobRequest;
import vn.terrawatch.core.dto.ForecastJobResponse;
import vn.terrawatch.core.dto.ReviewForecastRequest;
import vn.terrawatch.core.entity.ForecastReview;
import vn.terrawatch.core.entity.ForecastRun;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.ForecastReviewJpaRepository;
import vn.terrawatch.core.repository.ForecastRunJpaRepository;
import vn.terrawatch.core.service.ForecastJobService;
import vn.terrawatch.core.service.ForecastService;
import vn.terrawatch.core.service.LiveUpdateHub;

import java.time.OffsetDateTime;
import java.util.List;
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
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests calling the controller methods directly with mocked collaborators, so each review guard and the
 * persist-before-notify order are pinned exactly. Role checks and JSON binding are covered over HTTP by
 * ForecastJobApiTest, ForecastReviewQueueApiTest and AuthorizationMatrixTest.
 */
class ForecastControllerTest {
    private final ForecastService service = mock(ForecastService.class);
    private final ForecastJobService jobs = mock(ForecastJobService.class);
    private final ForecastRunJpaRepository runs = mock(ForecastRunJpaRepository.class);
    private final ForecastReviewJpaRepository reviews = mock(ForecastReviewJpaRepository.class);
    private final EventPublisher events = mock(EventPublisher.class);
    private final LiveUpdateHub live = mock(LiveUpdateHub.class);
    private final ForecastController controller = new ForecastController(service, jobs, runs, reviews, events, live);
    private final UUID runId = UUID.randomUUID();
    private final UUID reviewer = UUID.randomUUID();

    private ForecastRun run(String status, String availability, OffsetDateTime validUntil) {
        ForecastRun r = new ForecastRun();
        r.setUnitId("U1");
        r.setIssuedAt(OffsetDateTime.now().minusHours(1));
        r.setValidUntil(validUntil);
        r.setAvailability(availability);
        r.setReviewStatus(status);
        when(runs.findById(runId)).thenReturn(Optional.of(r));
        return r;
    }

    private static void assertStatus(Runnable action, int status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(status));
    }

    private void expectNoWrites() {
        verify(reviews, never()).saveAndFlush(any());
        verify(runs, never()).saveAndFlush(any());
        verifyNoInteractions(events, live);
    }

    // ---- createJob / queue / active ----

    @Test
    void createJobAnswers202WithTheRunsStatusAndKey() {
        ForecastRun created = new ForecastRun();
        created.setIdempotencyKey("U1|v1|m1|k");
        when(jobs.createJob("U1", "v1", null, "m1", "t1")).thenReturn(created);

        ResponseEntity<?> out = controller.createJob(new CreateForecastJobRequest("U1", null, null, "m1", "t1"));

        assertThat(out.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        ForecastJobResponse body = (ForecastJobResponse) out.getBody();
        assertThat(body.jobStatus()).isEqualTo("pending");
        assertThat(body.idempotencyKey()).isEqualTo("U1|v1|m1|k");
        assertThat(body.createdAt()).isEqualTo(created.getCreatedAt().toInstant());
    }

    @Test
    void queueAsksForPendingAndRunningOnlyAndMapsStatusToLowerCase() {
        ForecastRun r = new ForecastRun();
        r.setJobStatus(ForecastRun.JobStatus.RUNNING);
        when(runs.findByJobStatusRawIn(List.of("pending", "running"))).thenReturn(List.of(r));
        assertThat(controller.queue()).extracting(ForecastJobResponse::jobStatus).containsExactly("running");
    }

    @Test
    void activeUsesTheCurrentTime() {
        when(runs.findActiveForecasts(any(OffsetDateTime.class))).thenReturn(List.of());
        OffsetDateTime before = OffsetDateTime.now();
        assertThat(controller.active()).isEmpty();
        ArgumentCaptor<OffsetDateTime> now = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(runs).findActiveForecasts(now.capture());
        assertThat(now.getValue()).isAfterOrEqualTo(before).isBeforeOrEqualTo(OffsetDateTime.now());
    }

    // ---- review queue ----

    @Test
    void reviewQueueAcceptsOnlyTheFourStatusesAndDelegates() {
        for (String s : List.of("pending", "approved", "rejected", "all")) controller.reviewQueue(s);
        verify(service).reviewQueue("all");
        for (String bad : List.of("", "PENDING", "superseded", "all;--")) {
            assertStatus(() -> controller.reviewQueue(bad), 400);
        }
        verify(service, org.mockito.Mockito.times(4)).reviewQueue(anyString());
    }

    @Test
    void auditLogAndMetricsPassTheirParametersThrough() {
        controller.reviewAuditLog(25);
        controller.reviewMetrics(30);
        verify(service).reviewAuditLog(25);
        verify(service).reviewMetrics(30);
    }

    // ---- review ----

    @Test
    void unknownRunIs404() {
        when(runs.findById(runId)).thenReturn(Optional.empty());
        ResponseEntity<?> out = controller.review(runId, new ReviewForecastRequest("approved", null), reviewer);
        assertThat(out.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        expectNoWrites();
    }

    @Test
    void alreadyDecidedExpiredSupersededAndUnavailableRunsAre409() {
        run("approved", "available", OffsetDateTime.now().plusHours(5));
        assertStatus(() -> controller.review(runId, new ReviewForecastRequest("rejected", "x"), reviewer), 409);

        run("pending", "available", OffsetDateTime.now().minusMinutes(1));
        assertStatus(() -> controller.review(runId, new ReviewForecastRequest("approved", null), reviewer), 409);

        ForecastRun live = run("pending", "available", OffsetDateTime.now().plusHours(5));
        when(runs.existsNewer("U1", live.getRunId(), live.getIssuedAt())).thenReturn(true);
        assertStatus(() -> controller.review(runId, new ReviewForecastRequest("approved", null), reviewer), 409);

        run("pending", "unavailable", OffsetDateTime.now().plusHours(5));
        assertStatus(() -> controller.review(runId, new ReviewForecastRequest("approved", null), reviewer), 409);
        expectNoWrites();
    }

    @Test
    void rejectionNeedsANonBlankReason() {
        run("pending", "available", OffsetDateTime.now().plusHours(5));
        assertStatus(() -> controller.review(runId, new ReviewForecastRequest("rejected", null), reviewer), 400);
        assertStatus(() -> controller.review(runId, new ReviewForecastRequest("rejected", "   "), reviewer), 400);
        expectNoWrites();
    }

    @Test
    void unavailableRunMayStillBeRejectedWithAReason() {
        ForecastRun r = run("pending", "unavailable", OffsetDateTime.now().plusHours(5));
        ResponseEntity<?> out = controller.review(runId, new ReviewForecastRequest("rejected", "no data"), reviewer);
        assertThat(out.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(r.getReviewStatus()).isEqualTo("rejected");
    }

    @Test
    void approvalSavesReviewThenRunThenPublishesAndRefreshesTheLiveQueue() {
        ForecastRun r = run("pending", "available", OffsetDateTime.now().plusHours(5));

        ResponseEntity<?> out = controller.review(runId, new ReviewForecastRequest("approved", "ok"), reviewer);

        assertThat(out.getBody()).isEqualTo(Map.of("runId", runId, "reviewStatus", "approved"));
        assertThat(r.getReviewStatus()).isEqualTo("approved");
        ArgumentCaptor<ForecastReview> saved = ArgumentCaptor.forClass(ForecastReview.class);
        var order = inOrder(reviews, runs, events, live);
        order.verify(reviews).saveAndFlush(saved.capture());
        order.verify(runs).saveAndFlush(r);
        order.verify(events).publishEvent("FORECAST_REVIEWED",
            Map.of("run_id", runId.toString(), "decision", "approved", "reviewer_id", reviewer.toString()));
        order.verify(live).publish("queue");
        assertThat(saved.getValue().getReviewerId()).isEqualTo(reviewer);
        assertThat(saved.getValue().getDecision()).isEqualTo("approved");
        assertThat(saved.getValue().getReasonNotes()).isEqualTo("ok");
    }

    @Test
    void redisFailureDoesNotUndoTheReviewAndNullReviewerPublishesEmptyId() {
        run("pending", "available", OffsetDateTime.now().plusHours(5));
        doThrow(new IllegalStateException("redis down")).when(events).publishEvent(anyString(), anyMap());

        ResponseEntity<?> out = controller.review(runId, new ReviewForecastRequest("approved", null), null);

        assertThat(out.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(events).publishEvent(eq("FORECAST_REVIEWED"), eq(Map.of("run_id", runId.toString(), "decision", "approved", "reviewer_id", "")));
        verify(live).publish("queue");
    }
}
