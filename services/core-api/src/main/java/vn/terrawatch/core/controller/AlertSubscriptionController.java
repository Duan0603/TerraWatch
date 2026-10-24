package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import vn.terrawatch.core.dto.SubscriptionRequest;
import vn.terrawatch.core.dto.SubscriptionResponse;
import vn.terrawatch.core.service.AlertSubscriptionService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/alerts/subscriptions")
@Tag(name = "Alert Subscriptions", description = "Areas a citizen receives alerts for")
public class AlertSubscriptionController {
    private final AlertSubscriptionService service;

    public AlertSubscriptionController(AlertSubscriptionService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List the signed-in citizen's subscribed areas")
    public List<SubscriptionResponse> list(Authentication authentication) {
        return service.list(userId(authentication));
    }

    @PostMapping
    @Operation(summary = "Subscribe to a monitoring area or update its channels")
    public SubscriptionResponse subscribe(Authentication authentication, @Valid @RequestBody SubscriptionRequest request) {
        return service.subscribe(userId(authentication), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove one of the signed-in citizen's subscriptions")
    public void unsubscribe(Authentication authentication, @PathVariable UUID id) {
        service.unsubscribe(userId(authentication), id);
    }

    // JwtAuthenticationFilter always sets a UUID principal.
    private static UUID userId(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
