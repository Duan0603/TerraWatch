package vn.terrawatch.core.dto;

public record AuthResponse(String token, String role, UserProfileResponse user) {}
