package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vn.terrawatch.core.client.FcmSender;
import vn.terrawatch.core.client.SmsSender;
import vn.terrawatch.core.client.TwilioSmsSender;
import vn.terrawatch.core.dto.AlertBroadcastResponse;
import vn.terrawatch.core.dto.BroadcastAlertRequest;
import vn.terrawatch.core.dto.BroadcastHistoryItem;
import vn.terrawatch.core.dto.BroadcastPreview;
import vn.terrawatch.core.repository.BroadcastRepository;
import vn.terrawatch.core.repository.BroadcastRepository.Area;
import vn.terrawatch.core.repository.BroadcastRepository.Recipient;
import vn.terrawatch.core.repository.BroadcastRepository.SmsRecipient;
import vn.terrawatch.core.repository.DeviceTokenRepository;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Emergency broadcasts to citizens subscribed to an area, over FCM push and SMS. */
@Service
public class NotificationService {
    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);
    private static final Set<String> RISK_LEVELS = Set.of("low", "medium", "high", "extreme");
    private static final Set<String> PHASES = Set.of("pre_incident", "during_incident", "post_incident");
    private static final long VALID_HOURS = 24;
    private static final String DEFAULT_MESSAGE = "Phát hiện nguy cơ sạt lở đồi núi nghiêm trọng. Vui lòng di tản ngay!";

    private final BroadcastRepository broadcasts;
    private final DeviceTokenRepository devices;
    private final FcmSender fcm;
    private final SmsSender sms;
    private final String hotline;

    public NotificationService(BroadcastRepository broadcasts, DeviceTokenRepository devices,
                               FcmSender fcm, SmsSender sms,
                               @Value("${sms.hotline:112}") String hotline) {
        this.broadcasts = broadcasts;
        this.devices = devices;
        this.fcm = fcm;
        this.sms = sms;
        this.hotline = hotline;
    }

    public Map<String, Object> broadcastAlert(BroadcastAlertRequest req, UUID senderId) {
        String level = req.riskLevel() == null ? "" : req.riskLevel().toLowerCase(Locale.ROOT);
        if (!RISK_LEVELS.contains(level)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid riskLevel");
        String phase = req.incidentPhase() == null || req.incidentPhase().isBlank() ? "during_incident" : req.incidentPhase();
        if (!PHASES.contains(phase)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid incidentPhase");

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
        logger.info("[ALERT DISPATCH] Event: {}, Risk: {}, Phase: {}, Area: {}", req.eventId(), level, phase, req.targetArea());

        List<Area> areas = matchAreas(req);
        List<Integer> areaIds = areas.stream().map(Area::id).toList();
        List<Recipient> pushRecipients = areas.isEmpty() ? List.of() : broadcasts.recipients(areaIds);
        List<SmsRecipient> smsRecipients = areas.isEmpty() ? List.of() : broadcasts.smsRecipients(areaIds);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("event_id", req.eventId());
        result.put("risk_level", level);
        result.put("incident_phase", phase);
        result.put("timestamp", java.time.Instant.now().toString());

        if (pushRecipients.isEmpty() && smsRecipients.isEmpty()) {
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
            stored = broadcasts.insert(senderId, title, body, level, area.id(), validUntil,
                    pushRecipients.size(), idempotencyKey, run, phase);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate alert broadcast: event_id already processed");
        }

        // ── FCM push delivery ───────────────────────────────────────────
        Map<String, String> data = new LinkedHashMap<>();
        data.put("type", "EMERGENCY_ALERT");
        data.put("broadcastId", stored.broadcastId().toString());
        data.put("title", title);
        data.put("message", body);
        data.put("severity", level);
        data.put("areaName", area.name());
        data.put("issuedAt", stored.issuedAt().toString());
        data.put("validUntil", validUntil.toInstant().toString());

        int pushSent = 0;
        List<String> pushErrors = new ArrayList<>();
        for (Recipient to : pushRecipients) {
            FcmSender.Result outcome = fcm.send(to.fcmToken(), new FcmSender.Message(title, body, data));
            broadcasts.insertDelivery(stored.broadcastId(), to, outcome.ok(), outcome.error());
            if (outcome.ok()) pushSent++;
            else pushErrors.add(outcome.error());
            if (outcome.unregistered()) devices.forget(to.fcmToken());
        }

        // ── SMS delivery ────────────────────────────────────────────────
        String smsBody = TwilioSmsSender.smsBody(phase, area.name(), level, hotline);
        int smsSent = 0;
        List<String> smsErrors = new ArrayList<>();
        for (SmsRecipient to : smsRecipients) {
            SmsSender.Result outcome = sms.send(to.phoneNumber(), smsBody);
            broadcasts.insertSmsDelivery(stored.broadcastId(), to, outcome.ok(), outcome.error(), outcome.providerMessageId());
            if (outcome.ok()) smsSent++;
            else smsErrors.add(outcome.error());
        }
        broadcasts.updateDeliveryCounts(stored.broadcastId(), pushSent, pushRecipients.size() - pushSent,
                smsRecipients.size(), smsSent, smsRecipients.size() - smsSent);

        // ── Response ────────────────────────────────────────────────────
        result.put("channels", smsRecipients.isEmpty() ? List.of("FCM_PUSH") : List.of("FCM_PUSH", "SMS"));
        result.put("broadcast_id", stored.broadcastId().toString());
        result.put("recipients_estimated", pushRecipients.size());
        result.put("devices", pushRecipients.size());
        result.put("sent", pushSent);
        result.put("failed", pushRecipients.size() - pushSent);
        if (!pushErrors.isEmpty()) result.put("first_error", pushErrors.get(0));
        result.put("sms_recipients", smsRecipients.size());
        result.put("sms_sent", smsSent);
        result.put("sms_failed", smsRecipients.size() - smsSent);
        if (!smsErrors.isEmpty()) result.put("sms_first_error", smsErrors.get(0));
        String pushStatus = pushSent == 0 && !pushRecipients.isEmpty() ? "FAILED" : pushSent == pushRecipients.size() ? "DISPATCHED" : "PARTIAL";
        result.put("status", pushStatus);
        result.put("payload", Map.of("title", title, "body", body, "sms_body", smsBody));
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
        return new BroadcastPreview(area.id(), area.name(), audience[0], audience[1], audience[2]);
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
