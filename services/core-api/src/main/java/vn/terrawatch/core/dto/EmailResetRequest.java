package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Story 4.21: ask for a reset code by e-mail. */
public record EmailResetRequest(@NotBlank @Size(max = 150) String email) {}
