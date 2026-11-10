package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.dto.FieldReportResponse;
import vn.terrawatch.core.dto.ReportPhotoRequest;
import vn.terrawatch.core.dto.ReportPhotoResponse;
import vn.terrawatch.core.service.CommunityReportService;
import vn.terrawatch.core.service.FieldReportService;
import vn.terrawatch.core.service.LiveUpdateHub;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/community-reports")
@Tag(name = "Community Reports", description = "Báo Cáo Hiện Trường Từ Người Dân (Crowdsourcing)")
public class CommunityReportController {

    private final CommunityReportService reportService;
    private final FieldReportService fieldReports;
    private final LiveUpdateHub live;

    public CommunityReportController(CommunityReportService reportService, FieldReportService fieldReports, LiveUpdateHub live) {
        this.live = live;
        this.reportService = reportService;
        this.fieldReports = fieldReports;
    }

    @GetMapping
    @Operation(summary = "UC09: Danh sách báo cáo hiện trường từ cộng đồng")
    public ResponseEntity<List<Map<String, Object>>> listReports() {
        return ResponseEntity.ok(reportService.listReports());
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('OFFICER', 'ADMIN')")
    @Operation(summary = "Cập nhật trạng thái báo cáo hiện trường ('submitted', 'processed', 'archived')")
    public ResponseEntity<?> updateStatus(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        String status = body != null ? body.get("status") : null;
        if (status == null || !List.of("submitted", "processed", "archived").contains(status.trim().toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: must be submitted, processed, or archived");
        }
        var updated = reportService.updateStatus(id, status.trim().toLowerCase());
        live.publish("field_reports"); // Story 4.35
        return ResponseEntity.ok(updated);
    }

    @PostMapping
    @Operation(summary = "Send a field report (GPS + time seen + optional photo). 201 when new, 200 when this clientReportId was already stored")
    public ResponseEntity<FieldReportResponse> submitReport(Authentication authentication,
                                                            @Valid @RequestBody CommunityReportRequest request) {
        var submission = fieldReports.submit(userId(authentication), request);
        if (submission.created()) live.publish("field_reports"); // Story 4.35
        return ResponseEntity.status(submission.created() ? HttpStatus.CREATED : HttpStatus.OK).body(submission.report());
    }

    @GetMapping("/mine")
    @Operation(summary = "The signed-in citizen's own reports, newest first")
    public List<FieldReportResponse> mine(Authentication authentication) {
        return fieldReports.mine(userId(authentication));
    }

    @PostMapping("/photos")
    @Operation(summary = "Upload a report photo (JPEG or PNG, base64, up to 700 KB)")
    public ReportPhotoResponse uploadPhoto(Authentication authentication, @Valid @RequestBody ReportPhotoRequest request) {
        return fieldReports.uploadPhoto(userId(authentication), request.imageBase64());
    }

    @GetMapping("/photos/{photoId}")
    @Operation(summary = "A report photo (officer/admin only; the WebGIS loads it with its token)")
    public ResponseEntity<byte[]> photo(@PathVariable UUID photoId) {
        var photo = fieldReports.getPhoto(photoId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(photo.contentType()))
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate()).body(photo.bytes());
    }

    // JwtAuthenticationFilter always sets a UUID principal.
    private static UUID userId(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
