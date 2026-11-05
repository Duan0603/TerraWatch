package vn.terrawatch.core.dto;

/** hasAvatar tells clients whether GET /auth/me/avatar will return a picture. dateOfBirth is ISO yyyy-MM-dd. */
public record UserProfileResponse(String userId, String fullName, String email, String role, String phoneNumber,
                                  String authProvider, String dateOfBirth, String gender,
                                  String province, String district, String commune, String addressLine,
                                  String emergencyContactName, String emergencyContactPhone,
                                  String emergencyContactRelation, boolean hasAvatar) {}
