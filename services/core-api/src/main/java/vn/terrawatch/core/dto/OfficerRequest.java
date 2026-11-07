package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Public request for an officer account (Story 4.8): needs a verified phone and waits for an admin. */
public record OfficerRequest(
    @NotBlank @Size(max = 100) String fullName,
    @NotBlank @Email @Size(max = 150) String email,
    @NotBlank @Size(min = 8, max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String password,
    @NotBlank @JsonAlias("phone_number") @Size(max = 20) String phoneNumber,
    @NotBlank @JsonAlias({"phone_token", "id_token", "idToken"}) String phoneToken,
    @NotBlank @JsonAlias("department_unit") @Size(max = 150) String departmentUnit
) {
    @Override
    public String toString() { return "OfficerRequest[password=REDACTED]"; }
}
