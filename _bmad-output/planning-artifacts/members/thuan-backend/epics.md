# Thuận — Backend Engineer / Architect

**Updated:** 2026-10-13 | **Scope:** services/core-api, gateway and docker-compose.yml

The project now predicts rainfall-triggered landslide hazard for the next **24 hours**. [Canonical epics and acceptance criteria](../../epics.md) and [PRD](../../prd.md) supersede the previous segmentation plan. This member file is an assignment view, not a second acceptance-criteria source.

## Owned / co-owned stories

- **Story 1.1:** Multi-role registration and JWT.
- **Story 1.2:** PostGIS forecast and observation schema.
- **Story 1.3:** Gateway routing and access.
- **Story 2.4:** Field reports and event inventory.
- **Story 4.1:** Persisted orchestration and resilience.
- **Story 4.4:** Admin SMS/FCM broadcast.

## Responsibilities

- Keep JWT/admin/officer/citizen scope; derive actor identity server-side.
- Add forecast runs/reviews beside observed incidents, not by reusing detection fields.
- Implement persisted jobs, bounded retries, idempotency and recovery; fix Redis environment mismatch.
- Support forecast review/expiry APIs (4.2), mobile sync/subscriptions (5.1/5.3) and integration (5.4).

## Input/output contract

GIS snapshots + AI predictions → persisted forecast/review APIs, published GeoJSON with validity, and admin-confirmed SMS/FCM delivery. Current notification mock must not be described as real delivery.

See [API specification](../../../../docs/API_SPECIFICATION.md) and [architecture](../../architecture.md). Forecast endpoints are planned, not currently deployed.

## Sequence and completion evidence

Data feasibility and contract agreement → implementation → integration → measured evidence. Re-estimate the previous five-week schedule after pilot data access. Keep backlog/ready-for-dev status until implementation and checks actually pass; documentation changes do not complete a story.
