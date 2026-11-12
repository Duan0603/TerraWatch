package vn.terrawatch.core.dto;

/** Who a broadcast to this area would reach right now: push subscribers, registered phones, and SMS subscribers. */
public record BroadcastPreview(int areaId, String areaName, int subscribers, int devices, int smsSubscribers) {}
