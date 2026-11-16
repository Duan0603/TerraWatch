package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Story 4.44: ask for a code by SMS (code null) or check the code from the SMS. */
public record PhoneOtpRequest(@NotBlank @JsonAlias("phone_number") @Size(max = 20) String phoneNumber, @Size(max = 12) String code) {}
