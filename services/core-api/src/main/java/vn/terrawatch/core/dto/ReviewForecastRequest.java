package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ReviewForecastRequest(
        @NotBlank @Pattern(regexp = "approved|rejected") String decision,
        String reasonNotes
) {}

