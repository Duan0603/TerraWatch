package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
    @NotBlank @Email @Size(max = 150) String email,
    @NotBlank @Size(max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String password
) {
    @Override
    public String toString() { return "LoginRequest[password=REDACTED]"; }
}
