package vn.terrawatch.core.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * PUT replaces every field: null or blank clears an optional one. Phones are digits with an optional
 * leading +, 9-15 digits. gender is male | female | other. dateOfBirth is ISO yyyy-MM-dd.
 */
public record UpdateProfileRequest(
    @NotBlank @Size(max = 100) String fullName,
    @JsonAlias("phone_number") @Pattern(regexp = "^$|^\\+?[0-9]{9,15}$", message = "Invalid phone number") String phoneNumber,
    @Past LocalDate dateOfBirth,
    @Pattern(regexp = "^$|male|female|other", message = "Invalid gender") String gender,
    @Size(max = 100) String province,
    @Size(max = 100) String district,
    @Size(max = 100) String commune,
    @Size(max = 200) String addressLine,
    @Size(max = 100) String emergencyContactName,
    @Pattern(regexp = "^$|^\\+?[0-9]{9,15}$", message = "Invalid emergency contact phone") String emergencyContactPhone,
    @Size(max = 50) String emergencyContactRelation
) {}
