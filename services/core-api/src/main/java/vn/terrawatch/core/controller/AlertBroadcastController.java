package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.terrawatch.core.dto.AlertBroadcastResponse;
import vn.terrawatch.core.service.NotificationService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts/broadcasts")
@Tag(name = "Alert Broadcasts", description = "Emergency broadcasts addressed to the signed-in citizen")
public class AlertBroadcastController {
    private final NotificationService service;

    public AlertBroadcastController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Resync: broadcasts delivered to the caller in the last 7 days, with validity and revoked status")
    public List<AlertBroadcastResponse> mine(Authentication authentication) {
        return service.broadcastsFor((UUID) authentication.getPrincipal());
    }
}
