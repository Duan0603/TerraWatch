package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(max = 100) String fullName,
    @NotBlank @Email @Size(max = 150) String email,
    @NotBlank @Size(min = 8, max = 72) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) String password,
    @JsonAlias("phone_number") @Size(max = 20) String phoneNumber,
    @JsonAlias({"phone_token", "phoneToken", "id_token", "idToken", "otp", "otp_code", "otpCode"}) String phoneToken
) {
    // Story 4.7: no role field. Self-registration always creates a citizen (Story 1.1 AC1);
    // an admin promotes staff afterwards. An unknown "role" in the JSON is ignored.
    public RegisterRequest(String fullName, String email, String password, String phoneNumber) {
        this(fullName, email, password, phoneNumber, null);
    }

    public RegisterRequest(String fullName, String email, String password) {
        this(fullName, email, password, null, null);
    }

    @Override
    public String toString() { return "RegisterRequest[password=REDACTED]"; }
}

