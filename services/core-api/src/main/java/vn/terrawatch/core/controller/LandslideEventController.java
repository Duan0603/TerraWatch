package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.VerifyEventRequest;
import vn.terrawatch.core.service.LandslideEventService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/landslides")
@Tag(name = "Landslide Events", description = "Quản lý và Thẩm định Sự kiện Sạt lở Đất từ AI")
public class LandslideEventController {

    private final LandslideEventService landslideService;

    public LandslideEventController(LandslideEventService landslideService) {
        this.landslideService = landslideService;
    }

    @GetMapping("/queue")
    @Operation(summary = "FR3.1: Hàng đợi thẩm định sự kiện chờ cán bộ phê duyệt")
    public ResponseEntity<List<Map<String, Object>>> getVerificationQueue() {
        return ResponseEntity.ok(landslideService.getVerificationQueue());
    }

    @PatchMapping("/{id}/verify")
    @Operation(summary = "FR3.2 / UC04: Cán bộ phê duyệt hoặc bác bỏ điểm cảnh báo")
    public ResponseEntity<Map<String, Object>> verifyEvent(
            @PathVariable("id") String eventId,
            @RequestBody VerifyEventRequest request) {
        return ResponseEntity.ok(landslideService.verifyEvent(eventId, request));
    }

    @GetMapping(value = "/active", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "UC05: Lấy GeoJSON FeatureCollection các điểm sạt lở đã thẩm định")
    public ResponseEntity<String> getActiveEvents() {
        return ResponseEntity.ok(landslideService.getActiveVerifiedEvents());
    }

    @GetMapping("/geofence")
    @Operation(summary = "UC08 / NFR2: Truy vấn Geofencing tìm điểm sạt lở nguy hiểm trong bán kính")
    public ResponseEntity<List<Map<String, Object>>> queryGeofence(
            @RequestParam("lon") double lon,
            @RequestParam("lat") double lat,
            @RequestParam(value = "radius", defaultValue = "500") double radius) {
        return ResponseEntity.ok(landslideService.queryGeofence(lon, lat, radius));
    }

    @GetMapping(value = "/offline-sync", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "UC08: Xuất GeoJSON đồng bộ vào SQLite thiết bị di động")
    public ResponseEntity<String> getOfflineSync() {
        return ResponseEntity.ok(landslideService.exportOfflineSync());
    }
}
