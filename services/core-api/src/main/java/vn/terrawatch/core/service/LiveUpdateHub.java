package vn.terrawatch.core.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Story 4.35: tells open dashboards that something changed. An event carries only the kind of change
 * ("queue", "field_reports", "broadcasts"), never the data: the browser reloads through the normal authorised endpoints.
 * shortcut: in-memory, so one Core API instance only; with several instances publish through Redis.
 */
@Service
public class LiveUpdateHub {

    private static final Logger log = LoggerFactory.getLogger(LiveUpdateHub.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L; // the browser reconnects after this

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** A new stream; the first event ("hello") tells the browser it is connected. */
    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        send(emitter, SseEmitter.event().name("hello").reconnectTime(5000).data("{}"));
        return emitter;
    }

    /** Safe to call from anywhere, also with nobody connected. */
    public void publish(String type) {
        for (SseEmitter emitter : emitters) {
            send(emitter, SseEmitter.event().name("update").data("{\"type\":\"" + type + "\"}"));
        }
    }

    public int subscribers() {
        return emitters.size();
    }

    @Scheduled(fixedDelay = 25_000)
    void ping() {
        for (SseEmitter emitter : emitters) {
            send(emitter, SseEmitter.event().comment("ping"));
        }
    }

    private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
        } catch (IOException | IllegalStateException e) {
            emitters.remove(emitter); // the browser went away
            log.debug("Dropped a closed live-update stream: {}", e.getMessage());
        }
    }
}
