package vn.terrawatch.core.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "landslide_events", schema = "core_schema")
public class LandslideEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "detection_date")
    private OffsetDateTime detectionDate;

    @Column(name = "risk_level")
    private String riskLevel; // low, medium, high, extreme

    @Column(name = "status")
    private String status; // pending, verified, rejected, false_alarm

    @Column(name = "confidence_score")
    private Double confidenceScore;

    @Column(name = "slope_degrees")
    private Double slopeDegrees;

    @Column(name = "ndvi_drop")
    private Double ndviDrop;

    @Column(name = "affected_area_m2")
    private Double affectedAreaM2;

    @Column(name = "officer_note", columnDefinition = "TEXT")
    private String officerNote;

    @Column(name = "verified_by")
    private UUID verifiedBy;

    @Column(name = "verified_at")
    private OffsetDateTime verifiedAt;

    @Column(name = "satellite_scene_id", length = 100)
    private String satelliteSceneId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    public LandslideEvent() {}

    // Getters and Setters
    public UUID getEventId() { return eventId; }
    public void setEventId(UUID eventId) { this.eventId = eventId; }

    public OffsetDateTime getDetectionDate() { return detectionDate; }
    public void setDetectionDate(OffsetDateTime detectionDate) { this.detectionDate = detectionDate; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(Double confidenceScore) { this.confidenceScore = confidenceScore; }

    public Double getSlopeDegrees() { return slopeDegrees; }
    public void setSlopeDegrees(Double slopeDegrees) { this.slopeDegrees = slopeDegrees; }

    public Double getNdviDrop() { return ndviDrop; }
    public void setNdviDrop(Double ndviDrop) { this.ndviDrop = ndviDrop; }

    public Double getAffectedAreaM2() { return affectedAreaM2; }
    public void setAffectedAreaM2(Double affectedAreaM2) { this.affectedAreaM2 = affectedAreaM2; }

    public String getOfficerNote() { return officerNote; }
    public void setOfficerNote(String officerNote) { this.officerNote = officerNote; }

    public UUID getVerifiedBy() { return verifiedBy; }
    public void setVerifiedBy(UUID verifiedBy) { this.verifiedBy = verifiedBy; }

    public OffsetDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(OffsetDateTime verifiedAt) { this.verifiedAt = verifiedAt; }

    public String getSatelliteSceneId() { return satelliteSceneId; }
    public void setSatelliteSceneId(String satelliteSceneId) { this.satelliteSceneId = satelliteSceneId; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
