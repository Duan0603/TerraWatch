package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Story 4.21: the one-time token from a correct code plus the new password. */
public record EmailResetComplete(
    @NotBlank @Size(max = 150) String email,
    @NotBlank @Size(max = 200) String resetToken,
    @NotBlank @Size(min = 8, max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String newPassword
) {
    @Override
    public String toString() { return "EmailResetComplete[newPassword=REDACTED]"; }
}
