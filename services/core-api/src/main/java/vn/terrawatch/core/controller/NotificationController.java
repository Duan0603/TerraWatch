package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.BroadcastAlertRequest;
import vn.terrawatch.core.service.NotificationService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Emergency Notifications", description = "Phát Tán Thông Báo Cảnh Báo Khẩn Cấp Đa Kênh")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/broadcast")
    @Operation(summary = "FR3.3: Kích hoạt gửi thông báo khẩn qua FCM, SMS và Cell Broadcast")
    public ResponseEntity<Map<String, Object>> broadcastAlert(@RequestBody BroadcastAlertRequest request) {
        return ResponseEntity.ok(notificationService.broadcastAlert(request));
    }
}
