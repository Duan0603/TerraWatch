package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import vn.terrawatch.core.dto.BroadcastAlertRequest;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);

    public Map<String, Object> broadcastAlert(BroadcastAlertRequest req) {
        logger.info("[ALERT DISPATCH] Event: {}, Risk: {}, Area: {}", req.eventId(), req.riskLevel(), req.targetArea());

        return Map.of(
            "event_id", req.eventId(),
            "risk_level", req.riskLevel(),
            "channels", List.of("FCM_PUSH", "SMS_CELL_BROADCAST", "WEBSOCKET"),
            "timestamp", Instant.now().toString(),
            "recipients_estimated", 1250,
            "status", "DISPATCHED",
            "payload", Map.of(
                "title", "CẢNH BÁO SẠT LỞ ĐẤT KHẨN CẤP (" + req.riskLevel().toUpperCase() + ")",
                "body", req.message() != null ? req.message() : "Phát hiện nguy cơ sạt lở đồi núi nghiêm trọng. Vui lòng di tản ngay!"
            )
        );
    }
}
