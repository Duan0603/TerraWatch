package vn.terrawatch.core.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_avatars", schema = "core_schema")
public class UserAvatar {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "image_base64", nullable = false, columnDefinition = "TEXT")
    private String imageBase64;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    public UserAvatar() {}

    public UserAvatar(UUID userId, String imageBase64) {
        this.userId = userId;
        this.imageBase64 = imageBase64;
    }

    public UUID getUserId() { return userId; }
    public String getImageBase64() { return imageBase64; }
}
