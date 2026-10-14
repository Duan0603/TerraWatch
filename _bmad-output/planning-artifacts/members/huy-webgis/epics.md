# Huy — Frontend WebGIS Engineer

**Updated:** 2026-10-13 | **Scope:** apps/webgis

The project now predicts rainfall-triggered landslide hazard for the next **24 hours**. [Canonical epics and acceptance criteria](../../epics.md) and [PRD](../../prd.md) supersede the previous segmentation plan. This member file is an assignment view, not a second acceptance-criteria source.

## Owned / co-owned stories

- **Story 4.2:** Forecast review queue.
- **Story 4.3:** Rainfall, terrain and forecast dashboard.
- **Story 4.4:** Admin SMS/FCM broadcast.

## Responsibilities

- Replace hardcoded events/CSS map with authenticated API and real assessed-unit geometry.
- Replace before/after satellite comparison with observed/forecast rainfall charts, terrain and forecast-run comparison.
- Show validity, quality, effective resolution and unavailable/expired states; keep observed incidents distinct.
- Support login (1.1), authenticated review, recipient preview and end-to-end demo (5.4).

## Input/output contract

Core forecast/incident/report APIs + GIS terrain/rain layers → officer review and admin alert UI. Geometry represents a hazard assessment area, not an observed scar.

See [API specification](../../../../docs/API_SPECIFICATION.md) and [architecture](../../architecture.md). Forecast endpoints are planned, not currently deployed.

## Sequence and completion evidence

Data feasibility and contract agreement → implementation → integration → measured evidence. Re-estimate the previous five-week schedule after pilot data access. Keep backlog/ready-for-dev status until implementation and checks actually pass; documentation changes do not complete a story.
