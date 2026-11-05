package vn.terrawatch.core.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.dto.ForecastOfflineSyncResponse;
import vn.terrawatch.core.repository.ForecastRepository;

import java.time.Instant;

@Service
public class ForecastService {
    private final ForecastRepository forecasts;

    public ForecastService(ForecastRepository forecasts) {
        this.forecasts = forecasts;
    }

    @Transactional(readOnly = true)
    public ForecastOfflineSyncResponse offlineSync() {
        return new ForecastOfflineSyncResponse(Instant.now(), forecasts.listApprovedUnexpired());
    }
}
