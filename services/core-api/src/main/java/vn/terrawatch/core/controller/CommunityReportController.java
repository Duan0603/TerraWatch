package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.dto.FieldReportResponse;
import vn.terrawatch.core.dto.ReportPhotoRequest;
import vn.terrawatch.core.dto.ReportPhotoResponse;
import vn.terrawatch.core.service.CommunityReportService;
import vn.terrawatch.core.service.FieldReportService;

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

    public CommunityReportController(CommunityReportService reportService, FieldReportService fieldReports) {
        this.reportService = reportService;
        this.fieldReports = fieldReports;
    }

    @GetMapping
    @Operation(summary = "UC09: Danh sách báo cáo hiện trường từ cộng đồng")
    public ResponseEntity<List<Map<String, Object>>> listReports() {
        return ResponseEntity.ok(reportService.listReports());
    }

    @PostMapping
    @Operation(summary = "Send a field report (GPS + time seen + optional photo). 201 when new, 200 when this clientReportId was already stored")
    public ResponseEntity<FieldReportResponse> submitReport(Authentication authentication,
                                                            @Valid @RequestBody CommunityReportRequest request) {
        var submission = fieldReports.submit(userId(authentication), request);
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
    @Operation(summary = "A report photo by its unguessable id (public so the WebGIS can show it in an img tag)")
    public ResponseEntity<byte[]> photo(@PathVariable UUID photoId) {
        var photo = fieldReports.getPhoto(photoId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(photo.contentType()))
            .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic()).body(photo.bytes());
    }

    // JwtAuthenticationFilter always sets a UUID principal.
    private static UUID userId(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
