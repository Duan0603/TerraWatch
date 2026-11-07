package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.dto.AlertBroadcastResponse;
import vn.terrawatch.core.dto.BroadcastAlertRequest;
import vn.terrawatch.core.dto.BroadcastHistoryItem;
import vn.terrawatch.core.dto.BroadcastPreview;
import vn.terrawatch.core.repository.BroadcastRepository;
import vn.terrawatch.core.repository.BroadcastRepository.Area;
import vn.terrawatch.core.repository.BroadcastRepository.Recipient;
import vn.terrawatch.core.repository.DeviceTokenRepository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Emergency broadcasts to the citizens subscribed to an area, over FCM push (SMS has no provider and is never reported as sent). */
@Service
public class NotificationService {
    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);
    private static final Set<String> RISK_LEVELS = Set.of("low", "medium", "high", "extreme");
    private static final long VALID_HOURS = 24;
    private static final String DEFAULT_MESSAGE = "Phát hiện nguy cơ sạt lở đồi núi nghiêm trọng. Vui lòng di tản ngay!";

    private final BroadcastRepository broadcasts;
    private final DeviceTokenRepository devices;
    private final FcmSender fcm;

    public NotificationService(BroadcastRepository broadcasts, DeviceTokenRepository devices, FcmSender fcm) {
        this.broadcasts = broadcasts;
        this.devices = devices;
        this.fcm = fcm;
    }

    public Map<String, Object> broadcastAlert(BroadcastAlertRequest req, UUID senderId) {
        String level = req.riskLevel() == null ? "" : req.riskLevel().toLowerCase(Locale.ROOT);
        if (!RISK_LEVELS.contains(level)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid riskLevel");
        BroadcastRepository.RunRef run = null;
        if (req.runId() != null && !req.runId().isBlank()) {
            UUID runId;
            try {
                runId = UUID.fromString(req.runId().trim());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid runId");
            }
            run = broadcasts.citableRun(runId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Forecast is not approved, available and unexpired"));
        }
        logger.info("[ALERT DISPATCH] Event: {}, Risk: {}, Area: {}", req.eventId(), level, req.targetArea());

        List<Area> areas = matchAreas(req);
        List<Recipient> recipients = areas.isEmpty() ? List.of() : broadcasts.recipients(areas.stream().map(Area::id).toList());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("event_id", req.eventId());
        result.put("risk_level", level);
        result.put("channels", List.of("FCM_PUSH"));
        result.put("sms", "NOT_SENT: no SMS provider is connected");
        result.put("timestamp", java.time.Instant.now().toString());
        if (recipients.isEmpty()) {
            result.put("recipients_estimated", 0);
            result.put("status", "NO_RECIPIENTS");
            return result;
        }

        String title = "CẢNH BÁO SẠT LỞ ĐẤT KHẨN CẤP (" + level.toUpperCase(Locale.ROOT) + ")";
        String body = req.message() != null && !req.message().isBlank() ? req.message() : DEFAULT_MESSAGE;
        Area area = areas.get(0);
        OffsetDateTime validUntil = run != null ? run.validUntil() : OffsetDateTime.now().plusHours(VALID_HOURS);
        String idempotencyKey = req.eventId() != null && !req.eventId().isBlank() ? req.eventId().trim() : null;
        BroadcastRepository.Stored stored;
        try {
            stored = broadcasts.insert(senderId, title, body, level, area.id(), validUntil, recipients.size(), idempotencyKey, run);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate alert broadcast: event_id already processed");
        }
        Map<String, String> data = new LinkedHashMap<>();
        data.put("type", "EMERGENCY_ALERT");
        data.put("broadcastId", stored.broadcastId().toString());
        data.put("title", title);
        data.put("message", body);
        data.put("severity", level);
        data.put("areaName", area.name());
        data.put("issuedAt", stored.issuedAt().toString());
        data.put("validUntil", validUntil.toInstant().toString());

        int sent = 0;
        List<String> errors = new ArrayList<>();
        for (Recipient to : recipients) {
            FcmSender.Result outcome = fcm.send(to.fcmToken(), new FcmSender.Message(title, body, data));
            broadcasts.insertDelivery(stored.broadcastId(), to, outcome.ok(), outcome.error());
            if (outcome.ok()) sent++;
            else errors.add(outcome.error());
            if (outcome.unregistered()) devices.forget(to.fcmToken());
        }
        broadcasts.updateCounts(stored.broadcastId(), sent, recipients.size() - sent);
        result.put("broadcast_id", stored.broadcastId().toString());
        result.put("recipients_estimated", recipients.size());
        result.put("devices", recipients.size());
        result.put("sent", sent);
        result.put("failed", recipients.size() - sent);
        if (!errors.isEmpty()) result.put("first_error", errors.get(0));
        result.put("status", sent == 0 ? "FAILED" : sent == recipients.size() ? "DISPATCHED" : "PARTIAL");
        result.put("payload", Map.of("title", title, "body", body));
        return result;
    }

    public List<AlertBroadcastResponse> broadcastsFor(UUID userId) {
        return broadcasts.forUser(userId);
    }

    public List<BroadcastHistoryItem> history(int limit) {
        return broadcasts.history(Math.max(1, Math.min(limit, 500)));
    }

    /** Who a broadcast to this area would reach now; uses the same recipient rule as {@link #broadcastAlert}. */
    public BroadcastPreview preview(int areaId) {
        Area area = broadcasts.activeAreas().stream().filter(a -> a.id() == areaId).findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No active monitoring area with that id"));
        int[] audience = broadcasts.audience(List.of(areaId));
        return new BroadcastPreview(area.id(), area.name(), audience[0], audience[1]);
    }

    public void revoke(UUID broadcastId) {
        if (!broadcasts.revoke(broadcastId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No active broadcast with that id");
    }

    public List<BroadcastRepository.DeliveryItem> deliveries(UUID broadcastId) {
        return broadcasts.deliveries(broadcastId);
    }

    /** areaId wins; otherwise exact name match wins; fallback to substring contains match. */
    private List<Area> matchAreas(BroadcastAlertRequest req) {
        List<Area> all = broadcasts.activeAreas();
        if (req.areaId() != null) return all.stream().filter(a -> a.id() == req.areaId()).toList();
        String target = req.targetArea() == null ? "" : req.targetArea().trim().toLowerCase(Locale.ROOT);
        if (target.isEmpty()) return List.of();
        List<Area> exact = all.stream().filter(a -> a.name().equalsIgnoreCase(target)).toList();
        if (!exact.isEmpty()) return exact;
        return all.stream().filter(a -> {
            String name = a.name().toLowerCase(Locale.ROOT);
            return name.contains(target) || target.contains(name);
        }).toList();
    }
}
