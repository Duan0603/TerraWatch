package vn.terrawatch.core.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "report_photos", schema = "core_schema")
public class ReportPhoto {

    @Id
    @Column(name = "photo_id")
    private UUID photoId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "image_base64", nullable = false, columnDefinition = "TEXT")
    private String imageBase64;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public ReportPhoto() {}

    public ReportPhoto(UUID photoId, UUID userId, String contentType, String imageBase64) {
        this.photoId = photoId;
        this.userId = userId;
        this.contentType = contentType;
        this.imageBase64 = imageBase64;
    }

    public UUID getPhotoId() { return photoId; }
    public UUID getUserId() { return userId; }
    public String getContentType() { return contentType; }
    public String getImageBase64() { return imageBase64; }
}
