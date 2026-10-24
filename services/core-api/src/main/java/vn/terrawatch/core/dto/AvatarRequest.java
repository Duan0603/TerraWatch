package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** JPEG or PNG, base64 encoded, at most 200 KB once decoded. */
public record AvatarRequest(@NotBlank @Size(max = 300_000) String imageBase64) {
    @Override
    public String toString() { return "AvatarRequest[imageBase64=<omitted>]"; }
}
