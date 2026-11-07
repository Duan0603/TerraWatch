---
baseline_commit: a0525dd
---
# Story 4.13: Compare forecast runs of the same unit over time

Status: review

## Story

As an officer,
I want to compare the current forecast run with earlier runs of the same unit,
so that a change in score or level between runs is visible before I approve a warning.

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-13-forecast-run-comparison`
**Origin:** merged in PR #60 (`65d09b8`) without a story file. Written after the fact on 2026-11-07 from the code and the live review of `main` a0525dd; fixes found in that review are in Stories 4.7-4.9.

## Acceptance Criteria

1. The evidence panel opens a modal with the current run and `priorRuns` of the unit, newest first, with issue time, level, review status and the difference in score.
2. The value is called "Điểm thử nghiệm" (experimental score), never a probability (PRD section 3); a missing level shows "Không có dự báo" instead of an invented one (Story 4.7).
3. Runs without a score show a dash, not zero.

## Where it lives

`ForecastComparisonModal.jsx`, `RainfallEvidencePanel.jsx`, `forecastApi.js` (`priorRuns`).

## Tests and known gaps

No automated test. Real comparison needs real forecasts (blocked by the snapshot and model work, Epic 3).
