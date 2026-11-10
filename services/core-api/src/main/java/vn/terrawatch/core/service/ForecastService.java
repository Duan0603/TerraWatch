package vn.terrawatch.core.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.terrawatch.core.dto.ForecastOfflineSyncResponse;
import vn.terrawatch.core.dto.ForecastReviewAuditItem;
import vn.terrawatch.core.dto.ForecastReviewItem;
import vn.terrawatch.core.dto.ForecastReviewMetrics;
import vn.terrawatch.core.repository.ForecastRepository;

import java.time.Instant;
import java.util.List;

@Service
public class ForecastService {
    private final ForecastRepository forecasts;

    public ForecastService(ForecastRepository forecasts) {
        this.forecasts = forecasts;
    }

    @Transactional(readOnly = true)
    public List<ForecastReviewItem> reviewQueue(String status) {
        return forecasts.reviewQueue(status);
    }

    @Transactional(readOnly = true)
    public ForecastReviewMetrics reviewMetrics(int days) {
        return forecasts.reviewMetrics(days);
    }

    public List<ForecastReviewAuditItem> reviewAuditLog(int limit) {
        return forecasts.reviewAuditLog(limit);
    }

    @Transactional(readOnly = true)
    public ForecastOfflineSyncResponse offlineSync() {
        return new ForecastOfflineSyncResponse(Instant.now(), forecasts.listApprovedUnexpired());
    }
}
