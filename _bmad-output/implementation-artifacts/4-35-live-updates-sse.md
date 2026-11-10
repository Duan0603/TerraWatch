---
baseline_commit: b902b5c
---
# Story 4.35: Live updates for the command center (server-sent events)

Status: review

## Story

As an officer or admin,
I want the dashboard to update the moment a forecast is decided or a new proposal, field report or alert order appears,
so that I do not wait up to a minute for the next refresh or press "Thử lại".

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-35-live-updates-sse`
**Branch:** `feature/webgis-live-updates`, **stacked on** `feature/webgis-kpi-review-metrics` (Story 4.34) because both change `DashboardPage`; until 4.34 is merged the diff also shows its commit. Roadmap item 5.3.

## Acceptance Criteria

1. **AC1 (Core API):** `GET /api/v1/stream` (OFFICER or ADMIN; 401 without a token, 403 for a citizen) opens a `text/event-stream`. The first event is `hello`; afterwards `update` events carry `{"type": "queue" | "field_reports" | "broadcasts"}`; a `:ping` comment every 25 s keeps proxies from closing the connection. Dead connections are dropped.
2. **AC2 (publishers):** an `update` is published when a forecast is reviewed (`queue`), when the recovery poller completes a forecast job (`queue`), when a field report is submitted or its status changes (`field_reports`), and when an alert order is sent or revoked (`broadcasts`). The event says only that something changed, never the data: the browser reloads through the normal authorised endpoints.
3. **AC3 (gateway):** `/api/v1/stream` is routed to Core API with buffering off and a long read timeout.
4. **AC4 (web):** the dashboard keeps one stream open (fetch with the Authorization header, no token in the URL), reloads the queue, field reports, broadcasts and review metrics shortly after an `update` (debounced), reconnects with growing delay (2 s up to 30 s) and shows "trực tiếp" on the status chip only while connected. The 60 s polling stays as the fallback, so a dead stream never leaves the screen stale for long.
5. **AC5:** tests: Core API (roles, hello + update delivered, publish with no subscribers is harmless), web helpers (SSE parser, reconnect delay), e2e (an `update` makes the queue reload; the chip shows live status); all existing tests pass.

## Notes

- Shortcut: one Core API instance only (the hub lives in memory); with several instances, publish through Redis.
- Shortcut: the browser reloads whole lists on an event; fine at this size.
