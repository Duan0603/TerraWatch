package vn.terrawatch.core.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/** areaId is a gis_schema.monitoring_areas id; alertChannels holds PUSH and/or SMS. */
public record SubscriptionRequest(
    @NotNull Integer areaId,
    @NotEmpty List<@Pattern(regexp = "PUSH|SMS") String> alertChannels,
    @Pattern(regexp = "^$|^\\+?[0-9]{9,15}$", message = "Invalid phone number") String phoneNumber
) {}
