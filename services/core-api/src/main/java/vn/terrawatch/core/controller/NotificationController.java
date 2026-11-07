package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.BroadcastAlertRequest;
import vn.terrawatch.core.dto.BroadcastHistoryItem;
import vn.terrawatch.core.dto.BroadcastPreview;
import vn.terrawatch.core.repository.BroadcastRepository.DeliveryItem;
import vn.terrawatch.core.service.NotificationService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Emergency Notifications", description = "Phát Tán Thông Báo Cảnh Báo Khẩn Cấp Đa Kênh")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/broadcast")
    @Operation(summary = "FR3.3: Gửi cảnh báo khẩn cấp qua FCM tới người dân đăng ký vùng (SMS chưa có nhà cung cấp)")
    public ResponseEntity<Map<String, Object>> broadcastAlert(Authentication authentication, @RequestBody BroadcastAlertRequest request) {
        return ResponseEntity.ok(notificationService.broadcastAlert(request, (UUID) authentication.getPrincipal()));
    }

    @GetMapping("/broadcasts")
    @Operation(summary = "Lịch sử phát lệnh (admin): mới nhất trước, kèm số người nhận, gửi được, lỗi và trạng thái thu hồi")
    public List<BroadcastHistoryItem> history(@RequestParam(defaultValue = "100") int limit) {
        return notificationService.history(limit);
    }

    @GetMapping("/broadcast/preview")
    @Operation(summary = "Xem trước người nhận (admin): số thuê bao Push và thiết bị của khu vực trước khi phát")
    public BroadcastPreview preview(@RequestParam int areaId) {
        return notificationService.preview(areaId);
    }

    @PostMapping("/broadcast/{id}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Thu hồi một lệnh cảnh báo đã phát; thiết bị thấy trạng thái này ở lần đồng bộ sau")
    public void revoke(@PathVariable UUID id) {
        notificationService.revoke(id);
    }

    @GetMapping("/broadcast/{id}/deliveries")
    @Operation(summary = "Chi tiết người nhận và kết quả chuyển phát của một lệnh cảnh báo")
    public List<DeliveryItem> deliveries(@PathVariable UUID id) {
        return notificationService.deliveries(id);
    }
}
