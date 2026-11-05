package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.*;
import vn.terrawatch.core.entity.ForecastReview;
import vn.terrawatch.core.entity.ForecastRun;
import vn.terrawatch.core.event.EventPublisher;
import vn.terrawatch.core.repository.ForecastReviewJpaRepository;
import vn.terrawatch.core.repository.ForecastRunJpaRepository;
import vn.terrawatch.core.service.ForecastJobService;
import vn.terrawatch.core.service.ForecastService;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/forecasts")
@Tag(name = "Forecasts", description = "Forecast job orchestration, review and query")
public class ForecastController {
    private final ForecastService service;
    private final ForecastJobService jobService;
    private final ForecastRunJpaRepository runRepo;
    private final ForecastReviewJpaRepository reviewRepo;
    private final EventPublisher events;

    public ForecastController(ForecastService service, ForecastJobService jobService,
                              ForecastRunJpaRepository runRepo, ForecastReviewJpaRepository reviewRepo,
                              EventPublisher events) {
        this.service = service;
        this.jobService = jobService;
        this.runRepo = runRepo;
        this.reviewRepo = reviewRepo;
        this.events = events;
    }

    /* ---- Existing endpoint (Story 5.3) — NO BREAKING CHANGES ---- */

    @GetMapping("/offline-sync")
    @Operation(summary = "Approved, unexpired forecast zones with validity, for the phone's offline cache")
    public ForecastOfflineSyncResponse offlineSync() {
        return service.offlineSync();
    }

    /* ---- Story 4.1: New endpoints ---- */

    @PostMapping
    @PreAuthorize("hasAnyRole('OFFICER', 'ADMIN')")
    @Operation(summary = "Create a forecast job (202 Accepted); idempotent on same key")
    public ResponseEntity<?> createJob(@Valid @RequestBody CreateForecastJobRequest req) {
        ForecastRun run = jobService.createJob(req.unitId(), req.unitVersion(),
                req.snapshotId(), req.modelVersion(), req.thresholdVersion());

        var resp = new ForecastJobResponse(run.getRunId(),
                run.getJobStatus().name().toLowerCase(),
                run.getIdempotencyKey(),
                run.getCreatedAt().toInstant());

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(resp);
    }

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('OFFICER', 'ADMIN')")
    @Operation(summary = "List pending/running forecast jobs")
    public List<ForecastJobResponse> queue() {
        return runRepo.findByJobStatusRawIn(List.of("pending", "running"))
                .stream()
                .map(r -> new ForecastJobResponse(r.getRunId(),
                        r.getJobStatus().name().toLowerCase(),
                        r.getIdempotencyKey(),
                        r.getCreatedAt().toInstant()))
                .toList();
    }

    @GetMapping("/active")
    @Operation(summary = "Approved, active, unexpired forecasts")
    public List<ForecastJobResponse> active() {
        return runRepo.findActiveForecasts(OffsetDateTime.now())
                .stream()
                .map(r -> new ForecastJobResponse(r.getRunId(),
                        r.getJobStatus().name().toLowerCase(),
                        r.getIdempotencyKey(),
                        r.getCreatedAt().toInstant()))
                .toList();
    }

    @PatchMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('OFFICER', 'ADMIN')")
    @Operation(summary = "Approve or reject a forecast run")
    public ResponseEntity<?> review(@PathVariable UUID id,
                                    @Valid @RequestBody ReviewForecastRequest req,
                                    @AuthenticationPrincipal UUID reviewerId) {
        ForecastRun run = runRepo.findById(id).orElse(null);
        if (run == null) return ResponseEntity.notFound().build();

        // Persist review record
        reviewRepo.saveAndFlush(new ForecastReview(id, reviewerId, req.decision(), req.reasonNotes()));

        // Update run status
        run.setReviewStatus(req.decision());
        runRepo.saveAndFlush(run);

        // Notify after persist
        try {
            events.publishEvent("FORECAST_REVIEWED", Map.of(
                    "run_id", id.toString(),
                    "decision", req.decision(),
                    "reviewer_id", reviewerId != null ? reviewerId.toString() : ""));
        } catch (Exception e) {
            // non-fatal
        }

        return ResponseEntity.ok(Map.of("runId", id, "reviewStatus", req.decision()));
    }
}
