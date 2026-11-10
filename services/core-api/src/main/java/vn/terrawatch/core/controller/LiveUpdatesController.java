package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vn.terrawatch.core.service.LiveUpdateHub;

/** Story 4.35: officers and admins (SecurityConfig) get a push when the queue, field reports or alert orders change. */
@RestController
@RequestMapping("/api/v1/stream")
@Tag(name = "Live updates")
public class LiveUpdatesController {

    private final LiveUpdateHub hub;

    public LiveUpdatesController(LiveUpdateHub hub) {
        this.hub = hub;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Luồng sự kiện: 'hello' khi kết nối, 'update' {type} khi hàng đợi, báo cáo hiện trường hoặc lệnh cảnh báo đổi (cán bộ và admin)")
    public SseEmitter stream() {
        return hub.subscribe();
    }
}
