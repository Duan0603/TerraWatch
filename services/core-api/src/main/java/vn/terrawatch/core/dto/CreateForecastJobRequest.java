package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateForecastJobRequest(
        @NotBlank @Size(max = 50) String unitId,
        @Size(max = 20) String unitVersion,
        UUID snapshotId,
        @NotBlank @Size(max = 50) String modelVersion,
        @NotBlank @Size(max = 50) String thresholdVersion
) {
    public CreateForecastJobRequest {
        if (unitVersion == null) unitVersion = "v1";
    }
}

