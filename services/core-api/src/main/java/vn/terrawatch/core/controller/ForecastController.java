package vn.terrawatch.core.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.terrawatch.core.dto.ForecastOfflineSyncResponse;
import vn.terrawatch.core.service.ForecastService;

@RestController
@RequestMapping("/api/v1/forecasts")
@Tag(name = "Forecasts", description = "Approved 24h forecast zones")
public class ForecastController {
    private final ForecastService service;

    public ForecastController(ForecastService service) {
        this.service = service;
    }

    @GetMapping("/offline-sync")
    @Operation(summary = "Approved, unexpired forecast zones with validity, for the phone's offline cache")
    public ForecastOfflineSyncResponse offlineSync() {
        return service.offlineSync();
    }
}
