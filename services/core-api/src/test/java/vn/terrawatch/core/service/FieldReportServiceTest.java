package vn.terrawatch.core.service;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.CommunityReportRequest;
import vn.terrawatch.core.dto.FieldReportResponse;
import vn.terrawatch.core.entity.ReportPhoto;
import vn.terrawatch.core.repository.FieldReportRepository;
import vn.terrawatch.core.repository.ReportPhotoRepository;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FieldReportServiceTest {
    private static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    private final FieldReportRepository reports = mock(FieldReportRepository.class);
    private final ReportPhotoRepository photos = mock(ReportPhotoRepository.class);
    private final FieldReportService service = new FieldReportService(reports, photos);
    private final UUID me = UUID.randomUUID();

    private CommunityReportRequest request(UUID photoId, String description, OffsetDateTime observedAt, OffsetDateTime until) {
        return new CommunityReportRequest(UUID.randomUUID(), 104.1, 21.8, 12.0, description, photoId, observedAt, until);
    }

    private static void assertBadRequest(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
    }

    @Test
    void storesAPhotoAndReturnsItsUrl() {
        var result = service.uploadPhoto(me, PNG);
        assertThat(result.imageUrl()).isEqualTo("/api/v1/community-reports/photos/" + result.photoId());
        verify(photos).saveAndFlush(any(ReportPhoto.class));
    }

    @Test
    void rejectsNonBase64NonImageAndOversizedPhotos() {
        assertBadRequest(() -> service.uploadPhoto(me, "***"));
        assertBadRequest(() -> service.uploadPhoto(me, Base64.getEncoder().encodeToString("not an image".getBytes())));
        byte[] huge = new byte[FieldReportService.MAX_PHOTO_BYTES + 1];
        Arrays.fill(huge, (byte) 1);
        huge[0] = (byte) 0xFF; huge[1] = (byte) 0xD8; huge[2] = (byte) 0xFF;
        assertBadRequest(() -> service.uploadPhoto(me, Base64.getEncoder().encodeToString(huge)));
        verify(photos, never()).saveAndFlush(any());
    }

    @Test
    void submitRejectsFutureTimeBackwardsIntervalAndEmptyReport() {
        OffsetDateTime now = OffsetDateTime.now();
        assertBadRequest(() -> service.submit(me, request(null, "x", now.plusHours(1), null)));
        assertBadRequest(() -> service.submit(me, request(null, "x", now.minusHours(2), now.minusHours(3))));
        assertBadRequest(() -> service.submit(me, request(null, "  ", now.minusHours(1), null)));
        verify(reports, never()).insertIfAbsent(any(), any(), any());
    }

    @Test
    void submitRejectsAPhotoOfAnotherUserOrMissing() {
        UUID photoId = UUID.randomUUID();
        when(photos.findById(photoId)).thenReturn(Optional.of(new ReportPhoto(photoId, UUID.randomUUID(), "image/png", PNG)));
        assertBadRequest(() -> service.submit(me, request(photoId, null, OffsetDateTime.now().minusMinutes(5), null)));
        UUID missing = UUID.randomUUID();
        when(photos.findById(missing)).thenReturn(Optional.empty());
        assertBadRequest(() -> service.submit(me, request(missing, null, OffsetDateTime.now().minusMinutes(5), null)));
    }

    @Test
    void submitReportsCreatedOnlyForANewClientId() {
        var stored = new FieldReportResponse(7, "c", "submitted", "t", "o", null, "d", null, 21.8, 104.1);
        when(reports.findByClientId(any(), any())).thenReturn(stored);
        when(reports.insertIfAbsent(any(), any(), any())).thenReturn(true, false);
        var req = request(null, "Đất đá tràn xuống đường", OffsetDateTime.now().minusMinutes(10), null);
        assertThat(service.submit(me, req).created()).isTrue();
        var again = service.submit(me, req);
        assertThat(again.created()).isFalse();
        assertThat(again.report()).isSameAs(stored);
    }

    @Test
    void unknownPhotoIs404() {
        when(photos.findById(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getPhoto(UUID.randomUUID())).isInstanceOfSatisfying(ResponseStatusException.class,
            e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
    }
}
