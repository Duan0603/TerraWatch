package vn.terrawatch.core.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.dto.SubscriptionRequest;
import vn.terrawatch.core.dto.SubscriptionResponse;
import vn.terrawatch.core.entity.AlertSubscription;
import vn.terrawatch.core.entity.MonitoringArea;
import vn.terrawatch.core.repository.AlertSubscriptionRepository;
import vn.terrawatch.core.repository.MonitoringAreaJpaRepository;
import vn.terrawatch.core.repository.UserRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** A citizen's subscriptions to monitoring areas (who gets alerts for which area, over which channels). */
@Service
public class AlertSubscriptionService {
    private final AlertSubscriptionRepository subscriptions;
    private final MonitoringAreaJpaRepository areas;
    private final UserRepository users;

    public AlertSubscriptionService(AlertSubscriptionRepository subscriptions, MonitoringAreaJpaRepository areas,
                                    UserRepository users) {
        this.subscriptions = subscriptions;
        this.areas = areas;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionResponse> list(UUID userId) {
        var mine = subscriptions.findByUserIdAndActiveTrueOrderBySubscribedAtDesc(userId);
        Map<Integer, MonitoringArea> byId = areas.findAllById(mine.stream().map(AlertSubscription::getAreaId).toList())
            .stream().collect(Collectors.toMap(MonitoringArea::getAreaId, Function.identity()));
        return mine.stream().map(s -> toResponse(s, byId.get(s.getAreaId()))).toList();
    }

    /** Subscribing again to the same area updates its channels instead of failing. */
    @Transactional
    public SubscriptionResponse subscribe(UUID userId, SubscriptionRequest request) {
        MonitoringArea area = areas.findById(request.areaId())
            .filter(a -> Boolean.TRUE.equals(a.getIsActive()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Monitoring area not found"));
        boolean push = request.alertChannels().contains("PUSH");
        boolean sms = request.alertChannels().contains("SMS");
        if (sms && !hasPhone(userId, request.phoneNumber())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A phone number is required for SMS alerts");
        }
        var subscription = subscriptions.findByUserIdAndAreaId(userId, area.getAreaId())
            .orElseGet(() -> new AlertSubscription(userId, area.getAreaId(), push, sms));
        subscription.setChannels(push, sms);
        return toResponse(subscriptions.save(subscription), area);
    }

    /** Only the owner can remove a subscription; someone else's id looks the same as an unknown id. */
    @Transactional
    public void unsubscribe(UUID userId, UUID subscriptionId) {
        var subscription = subscriptions.findBySubscriptionIdAndUserId(subscriptionId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subscription not found"));
        subscriptions.delete(subscription);
    }

    /** True when the request carries a number (saved to the profile) or the profile already has one. */
    private boolean hasPhone(UUID userId, String requestPhone) {
        var user = users.findById(userId).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        if (requestPhone != null && !requestPhone.isBlank()) {
            user.setPhoneNumber(requestPhone);
            users.save(user);
            return true;
        }
        return user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank();
    }

    private static SubscriptionResponse toResponse(AlertSubscription s, MonitoringArea area) {
        var channels = new java.util.ArrayList<String>();
        if (s.isChannelPush()) channels.add("PUSH");
        if (s.isChannelSms()) channels.add("SMS");
        return new SubscriptionResponse(s.getSubscriptionId().toString(), s.getAreaId(),
            area == null ? null : area.getName(), channels, s.getSubscribedAt().toString());
    }
}
