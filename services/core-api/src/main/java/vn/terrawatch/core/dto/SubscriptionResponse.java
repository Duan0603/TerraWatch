package vn.terrawatch.core.dto;

import java.util.List;

public record SubscriptionResponse(String subscriptionId, Integer areaId, String areaName,
                                   List<String> alertChannels, String subscribedAt) {}
