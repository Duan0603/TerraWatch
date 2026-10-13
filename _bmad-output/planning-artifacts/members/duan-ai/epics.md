# Duẫn — AI / Forecasting Engineer

**Updated:** 2026-10-13 | **Scope:** services/ai-service

The project now predicts rainfall-triggered landslide hazard for the next **24 hours**. [Canonical epics and acceptance criteria](../../epics.md) and [PRD](../../prd.md) supersede the previous segmentation plan. This member file is an assignment view, not a second acceptance-criteria source.

## Owned / co-owned stories

- **Story 3.1:** Historical dataset and baseline.
- **Story 3.2:** Candidate model and backtesting.
- **Story 3.3:** Versioned forecast inference.
- **Story 3.4:** Hazard levels and quality policy.

## Responsibilities

- Audit labels and archive availability with Tú before selecting a model.
- Build baseline, candidate, leakage-safe evaluation and calibration; replace segmentation metrics with forecast evidence.
- Consume immutable feature snapshots and return versioned 24h results; no synthetic polygon or fabricated accuracy.
- Support orchestration and integration in Stories 4.1 and 5.4.

## Input/output contract

Historical events + as-of rainfall/forecast/terrain snapshots → model/evaluation artifacts and 24h hazard output. Model family and numeric quality limits remain to be validated.

See [API specification](../../../../docs/API_SPECIFICATION.md) and [architecture](../../architecture.md). Forecast endpoints are planned, not currently deployed.

## Sequence and completion evidence

Data feasibility and contract agreement → implementation → integration → measured evidence. Re-estimate the previous five-week schedule after pilot data access. Keep backlog/ready-for-dev status until implementation and checks actually pass; documentation changes do not complete a story.
