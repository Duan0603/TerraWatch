package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record CreateForecastJobRequest(
        @NotBlank String unitId,
        String unitVersion,
        UUID snapshotId,
        @NotBlank String modelVersion,
        @NotBlank String thresholdVersion
) {
    public CreateForecastJobRequest {
        if (unitVersion == null) unitVersion = "v1";
    }
}

