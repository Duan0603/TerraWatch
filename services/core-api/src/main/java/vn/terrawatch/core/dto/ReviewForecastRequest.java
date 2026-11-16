package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ReviewForecastRequest(
        @NotBlank @Pattern(regexp = "approved|rejected") String decision,
        @Size(max = 2000) String reasonNotes
) {}

