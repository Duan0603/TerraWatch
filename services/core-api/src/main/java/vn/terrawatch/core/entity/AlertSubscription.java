package vn.terrawatch.core.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "alert_subscriptions", schema = "core_schema")
public class AlertSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "subscription_id")
    private UUID subscriptionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "area_id")
    private Integer areaId;

    @Column(name = "channel_push", nullable = false)
    private boolean channelPush = true;

    @Column(name = "channel_sms", nullable = false)
    private boolean channelSms = true;

    @Column(name = "subscribed_at")
    private OffsetDateTime subscribedAt = OffsetDateTime.now();

    @Column(name = "is_active")
    private boolean active = true;

    public AlertSubscription() {}

    public AlertSubscription(UUID userId, Integer areaId, boolean channelPush, boolean channelSms) {
        this.userId = userId;
        this.areaId = areaId;
        this.channelPush = channelPush;
        this.channelSms = channelSms;
    }

    public UUID getSubscriptionId() { return subscriptionId; }
    public UUID getUserId() { return userId; }
    public Integer getAreaId() { return areaId; }
    public boolean isChannelPush() { return channelPush; }
    public boolean isChannelSms() { return channelSms; }
    public OffsetDateTime getSubscribedAt() { return subscribedAt; }
    public boolean isActive() { return active; }

    public void setChannels(boolean push, boolean sms) {
        this.channelPush = push;
        this.channelSms = sms;
    }
}
