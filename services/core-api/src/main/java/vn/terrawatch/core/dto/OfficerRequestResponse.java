package vn.terrawatch.core.dto;

/** requestId is the new user's id; approvalStatus is always "pending" until an admin decides. */
public record OfficerRequestResponse(String requestId, String approvalStatus, String message) {}
