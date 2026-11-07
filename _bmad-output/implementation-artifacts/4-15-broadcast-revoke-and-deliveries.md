---
baseline_commit: a0525dd
---
# Story 4.15: Revoke a broadcast and see its recipients

Status: review

## Story

As an admin,
I want to revoke a sent warning and to see who received it and with what result,
so that a wrong warning can be withdrawn and delivery can be checked after the fact (PRD FR4).

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-15-broadcast-revoke-and-deliveries`
**Origin:** merged in PR #60 (`65d09b8`) without a story file. Written after the fact on 2026-11-07 from the code and the live review of `main` a0525dd; fixes found in that review are in Stories 4.7-4.9.

## Acceptance Criteria

1. `POST /notifications/broadcast/{id}/revoke` (admin only) marks the broadcast revoked (404 if it is not active). It sends no push: phones learn the revocation at their next `/forecasts/offline-sync` (PRD FR5).
2. `GET /notifications/broadcast/{id}/deliveries` (admin only) lists each recipient with phone, status and error; it never returns FCM tokens (Story 4.7).
3. The history modal shows both; a revoked broadcast is labelled.

## Where it lives

`NotificationController`, `NotificationService`, `BroadcastRepository`, `BroadcastHistoryModal.jsx`.

## Tests and known gaps

`BroadcastAdminApiTest` (history, revoke, deliveries without token). Live check with a real FCM push: see the 2026-11-07 report.
