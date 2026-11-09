---
baseline_commit: b39c2bb
---
# Story 4.30: Demo forecast seed must leave the pending zone reviewable

Status: review

## Story

As a presenter or tester,
I want `seed-demo-forecasts.sql` to give me one forecast that an officer can really approve,
so that the review flow can be shown and tested after any number of re-runs.

**Epic:** Epic 4 (WebGIS) / Story 5.3 demo data
**Sprint key:** `4-30-demo-seed-availability`
**Branch:** `fix/demo-seed-availability` (from `main` at b39c2bb). Found while running the Officer flow by hand on the live Docker stack (2026-11-09).

## Finding

After the manual run the review queue held three forecasts: all expired or "unavailable". `DEMO_PENDING` was `availability = 'unavailable'` (reason "AI service unavailable (circuit breaker)"), because a forecast job had touched the row and the seed's `ON CONFLICT ... DO UPDATE` never reset that column. Approving it returned 409 "Unavailable forecast cannot be approved" however often the seed was re-run.

## Acceptance Criteria

1. **AC1:** re-running the seed sets `availability = 'available'` and clears `unavailability_reason` on the three demo rows.
2. **AC2:** after the seed, an officer can approve `DEMO_PENDING` (200) and the review appears in the review audit log.
3. **AC3:** no change to the table schema or to the application code.

## Notes

- Verified by hand on the live stack after the change (see the report of this session).
- The pipeline question behind it (a job marks a run unavailable when the AI circuit breaker opens) is left as it is; it is correct behaviour for real data.
