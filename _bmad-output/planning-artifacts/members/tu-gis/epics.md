# Tú — GIS / Rainfall Data Engineer

**Updated:** 2026-10-13 | **Scope:** services/gis-service and database

The project now predicts rainfall-triggered landslide hazard for the next **24 hours**. [Canonical epics and acceptance criteria](../../epics.md) and [PRD](../../prd.md) supersede the previous segmentation plan. This member file is an assignment view, not a second acceptance-criteria source.

## Owned / co-owned stories

- **Story 1.2:** PostGIS forecast and observation schema.
- **Story 2.1:** Observed and forecast rainfall ingestion.
- **Story 2.2:** DEM terrain and assessment units.
- **Story 2.3:** As-of feature snapshots.

## Responsibilities

- Confirm one pilot AOI, rainfall estimate provider and forecast archive; preserve provenance/availability.
- Extract DEM features and versioned assessment units; do not confuse DEM resolution with rain resolution.
- Deliver consistent units, temporal accumulation and missing/stale quality flags; historical and online feature construction must match.
- Support label spatial uncertainty (2.4/3.1), dashboard (4.3) and integration (5.4).

## Input/output contract

Observed/forecast rainfall + DEM → versioned assessment units, source records and as-of feature snapshots for AI/Core. Exposure layers are separate from occurrence hazard.

See [API specification](../../../../docs/API_SPECIFICATION.md) and [architecture](../../architecture.md). Forecast endpoints are planned, not currently deployed.

## Sequence and completion evidence

Data feasibility and contract agreement → implementation → integration → measured evidence. Re-estimate the previous five-week schedule after pilot data access. Keep backlog/ready-for-dev status until implementation and checks actually pass; documentation changes do not complete a story.
