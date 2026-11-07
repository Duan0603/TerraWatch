package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Story 4.20: new password for an account, proved by an OTP sent to the phone registered on it. */
public record PasswordResetRequest(
    @NotBlank @Size(max = 150) String email,
    @NotBlank @JsonAlias("phone_number") @Size(max = 20) String phoneNumber,
    @NotBlank @JsonAlias({"phone_token", "id_token", "idToken"}) String phoneToken,
    @NotBlank @Size(min = 8, max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String newPassword
) {
    @Override
    public String toString() { return "PasswordResetRequest[newPassword=REDACTED]"; }
}
