package vn.terrawatch.core.dto;

public record UserProfileResponse(String userId, String fullName, String email, String role, String phoneNumber) {}
