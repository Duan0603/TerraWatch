package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** phoneNumber is optional: null or blank clears it. Digits only, optional leading +, 9-15 digits. */
public record UpdateProfileRequest(
    @NotBlank @Size(max = 100) String fullName,
    @JsonAlias("phone_number") @Pattern(regexp = "^$|^\\+?[0-9]{9,15}$", message = "Invalid phone number") String phoneNumber
) {}
