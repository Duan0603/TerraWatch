package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Story 4.21: the 6-digit code from the e-mail. */
public record EmailResetVerify(@NotBlank @Size(max = 150) String email, @NotBlank @Size(max = 12) String code) {}
