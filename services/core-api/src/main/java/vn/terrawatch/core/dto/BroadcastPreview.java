package vn.terrawatch.core.dto;

/** Who a broadcast to this area would reach right now: push subscribers and their registered phones. */
public record BroadcastPreview(int areaId, String areaName, int subscribers, int devices) {}
