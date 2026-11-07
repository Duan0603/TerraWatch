package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Story 4.20: "does this email belong to this phone?" asked before an OTP SMS is sent. */
public record PasswordResetCheck(
    @NotBlank @Size(max = 150) String email,
    @NotBlank @JsonAlias("phone_number") @Size(max = 20) String phoneNumber
) {}
