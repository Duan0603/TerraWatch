package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank @Size(max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String currentPassword,
    @NotBlank @Size(min = 8, max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String newPassword
) {
    @Override
    public String toString() { return "ChangePasswordRequest[passwords=REDACTED]"; }
}
