# Lâm — Mobile App Engineer

**Updated:** 2026-10-13 | **Scope:** apps/mobile

The project now predicts rainfall-triggered landslide hazard for the next **24 hours**. [Canonical epics and acceptance criteria](../../epics.md) and [PRD](../../prd.md) supersede the previous segmentation plan. This member file is an assignment view, not a second acceptance-criteria source.

## Owned / co-owned stories

- **Story 5.1:** Subscriptions and notification reception.
- **Story 5.2:** Mobile field reports.
- **Story 5.3:** Expiry-aware offline geofencing.

## Responsibilities

- Implement citizen login, area subscriptions/device token and alerts with validity.
- Cache approved geometry with issue/expiry/supersession; show stale data and last sync while offline.
- Run geofencing locally; test platform permissions rather than promise silent-mode override.
- Retain explicit photo/GPS reports and retry queue; support integration/expiry scenarios (5.4).

## Input/output contract

Core published forecast snapshots + SMS/FCM → expiry-aware mobile warnings. Continuous GPS stays local; offline devices cannot discover new forecasts/revocations until reconnect.

See [API specification](../../../../docs/API_SPECIFICATION.md) and [architecture](../../architecture.md). Forecast endpoints are planned, not currently deployed.

## Sequence and completion evidence

Data feasibility and contract agreement → implementation → integration → measured evidence. Re-estimate the previous five-week schedule after pilot data access. Keep backlog/ready-for-dev status until implementation and checks actually pass; documentation changes do not complete a story.
