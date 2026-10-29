package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** JPEG or PNG, base64, at most 700 KB once decoded (about 933,000 characters of base64, under the gateway's 1 MB body limit). */
public record ReportPhotoRequest(@NotBlank @Size(max = 1_000_000) String imageBase64) {
    @Override
    public String toString() { return "ReportPhotoRequest[imageBase64=<omitted>]"; }
}
