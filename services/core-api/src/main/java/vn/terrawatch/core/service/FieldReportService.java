package vn.terrawatch.core.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.dto.FieldReportResponse;
import vn.terrawatch.core.dto.ReportPhotoResponse;
import vn.terrawatch.core.entity.ReportPhoto;
import vn.terrawatch.core.repository.FieldReportRepository;
import vn.terrawatch.core.repository.ReportPhotoRepository;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/** Photos and field reports from citizens. The reporter is always the authenticated user. */
@Service
public class FieldReportService {
    static final int MAX_PHOTO_BYTES = 700_000;
    private static final Duration FUTURE_SKEW = Duration.ofMinutes(5);
    static final String PHOTO_URL = "/api/v1/community-reports/photos/";

    public record StoredPhoto(String contentType, byte[] bytes) {}

    /** created is true for a new report and false when the same client report id was already stored. */
    public record Submission(FieldReportResponse report, boolean created) {}

    private final FieldReportRepository reports;
    private final ReportPhotoRepository photos;

    public FieldReportService(FieldReportRepository reports, ReportPhotoRepository photos) {
        this.reports = reports;
        this.photos = photos;
    }

    @Transactional
    public ReportPhotoResponse uploadPhoto(UUID userId, String imageBase64) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(imageBase64);
        } catch (IllegalArgumentException notBase64) {
            throw bad("Image is not valid base64");
        }
        if (bytes.length > MAX_PHOTO_BYTES) {
            throw bad("Image is larger than 700 KB");
        }
        String contentType = contentType(bytes);
        if (contentType == null) {
            throw bad("Image must be JPEG or PNG");
        }
        UUID photoId = UUID.randomUUID();
        photos.saveAndFlush(new ReportPhoto(photoId, userId, contentType, imageBase64)); // flush: the report row is written with plain SQL and references this photo
        return new ReportPhotoResponse(photoId.toString(), PHOTO_URL + photoId);
    }

    @Transactional(readOnly = true)
    public StoredPhoto getPhoto(UUID photoId) {
        var photo = photos.findById(photoId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        return new StoredPhoto(photo.getContentType(), Base64.getDecoder().decode(photo.getImageBase64()));
    }

    @Transactional
    public Submission submit(UUID userId, CommunityReportRequest request) {
        if (request.observedAt().isAfter(OffsetDateTime.now().plus(FUTURE_SKEW))) {
            throw bad("observedAt is in the future");
        }
        if (request.observedUntil() != null && request.observedUntil().isBefore(request.observedAt())) {
            throw bad("observedUntil is before observedAt");
        }
        boolean noText = request.description() == null || request.description().isBlank();
        if (noText && request.photoId() == null) {
            throw bad("A report needs a photo or a description");
        }
        if (request.photoId() != null
                && photos.findById(request.photoId()).filter(p -> p.getUserId().equals(userId)).isEmpty()) {
            throw bad("Photo not found for this user");
        }
        String imageUrl = request.photoId() == null ? null : PHOTO_URL + request.photoId();
        boolean created = reports.insertIfAbsent(userId, request, imageUrl);
        return new Submission(reports.findByClientId(userId, request.clientReportId()), created);
    }

    @Transactional(readOnly = true)
    public List<FieldReportResponse> mine(UUID userId) {
        return reports.listByUser(userId);
    }

    /** JPEG or PNG by file signature, not by what the client claims. */
    private static String contentType(byte[] b) {
        if (b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length > 4 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        return null;
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
