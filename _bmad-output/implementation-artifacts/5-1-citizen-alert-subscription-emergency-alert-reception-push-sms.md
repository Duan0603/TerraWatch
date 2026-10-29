---
baseline_commit: 64bd674
---
# Story 5.1: Citizen alert subscription and emergency alert reception (push)

Status: in-progress

## Story

As a Citizen,
I want my phone to be registered for push alerts and to receive an emergency warning for the areas I follow, even if I missed the push,
so that I am told to evacuate and can review what was sent, when it was issued and whether it is still valid.

**Epic:** Epic 5: Mobile and end-to-end verification
**Sprint key:** `5-1-citizen-alert-subscription-emergency-alert-reception-push-sms`
**Branches:** backend `feature/core-alert-push` (Thuận's part, built here because it does not exist), mobile `feature/mobile-push-alerts`.

## What exists and what does not (read from code on `main`, 2026-10-30)

- Done earlier (UI only): subscription screen, area list, emergency red screen, SQLite `alert_history`, history list, a "simulate alert" test button. Area subscriptions API exists (Story 1.5/5.7).
- **Not real:** `POST /api/v1/notifications/broadcast` only logs and returns a fixed `recipients_estimated: 1250`; it sends nothing and stores nothing. `POST /api/v1/alerts/devices/register` does not exist (the old mobile call returned 401 and was removed). The app has no `firebase_messaging`, so no push can arrive. The earlier version of this story ticked AC2/AC3 against the simulated path only; this version replaces it.
- SMS needs a cellular provider and is **out of scope**: the broadcast records SMS as `skipped`, never as delivered.

## Acceptance Criteria

1. **AC1 — Device registration (backend):** `POST /api/v1/alerts/devices/register {fcmToken, deviceType}` (signed in) stores the token for the user; the same token registered by another account moves to that account (shared phone). `DELETE /api/v1/alerts/devices` with `{fcmToken}` removes it (logout). Blank/oversized tokens → 400. No token → 401.
2. **AC2 — Real broadcast:** `POST /api/v1/notifications/broadcast` (admin only, unchanged) resolves the target area (`areaId` if given, else the monitoring area whose name matches `targetArea`), finds users with an active subscription to that area with push enabled, stores an `alert_broadcasts` row (severity, message, `valid_until` = now + 24 h, area) and one `alert_deliveries` row per device token, and sends each through FCM HTTP v1. The response keeps the old keys (`event_id, risk_level, channels, timestamp, status, payload`) and `recipients_estimated` becomes the real recipient count, plus `broadcast_id`, `devices`, `sent`, `failed`. No matching area or no recipients → `status: "NO_RECIPIENTS"` and nothing is sent. SMS is recorded as `skipped`.
3. **AC3 — FCM sender:** `FcmSender` uses a Firebase service account from `FIREBASE_SERVICE_ACCOUNT_FILE` (path, never committed). When it is not configured the broadcast still stores the rows and marks deliveries `failed` with the error "FCM not configured" — it never reports delivery that did not happen. A token FCM reports as unregistered (404/`UNREGISTERED`) is deleted. The message is a notification message (so the system shows it when the app is closed) with data `{type: EMERGENCY_ALERT, broadcastId, severity, areaName, issuedAt, validUntil}`, Android priority HIGH and channel `emergency_alarm`.
4. **AC4 — Resync endpoint:** `GET /api/v1/alerts/broadcasts` (signed in) returns the broadcasts delivered to the user in the last 7 days: `{broadcastId, title, message, severity, areaName, issuedAt, validUntil, status (active|revoked), expired}`. `POST /api/v1/notifications/broadcast/{id}/revoke` (admin) marks a broadcast revoked.
5. **AC5 — Mobile registration:** after login / app start the app asks for notification permission (Android 13+), gets the FCM token, registers it, and re-registers when the token refreshes. Logout unregisters it (best effort). Missing permission or no Firebase never blocks the app.
6. **AC6 — Mobile reception:** a push received while the app is open triggers the siren notification and the red screen; a push tapped from the system tray (app in background or closed) opens the red screen. Every received alert is saved in `alert_history` once per `broadcastId` (a duplicate updates the row).
7. **AC7 — History with validity:** the history list shows issue time, valid-until and a status chip (Còn hiệu lực / Đã hết hạn / Đã thu hồi). On app start and pull-to-refresh the app resyncs from `GET /alerts/broadcasts`: missed alerts appear, and a revoked alert turns "Đã thu hồi" and is not shown as current.
8. **AC8 — Permissions visible:** when the system blocks notifications for the app, the alerts screen says so and explains how to enable them (no silent failure).
9. **AC9 — Privacy:** recipients are chosen only by static subscriptions; no GPS goes to the server.

## Tasks / Subtasks

- [ ] **Task 1: Migration V8** (AC: #1-#4) — `device_tokens` table; `alert_broadcasts` gets `area_id`, `valid_until`, `status`; `alert_deliveries` already exists. Copy into `database/migrations/`.
- [ ] **Task 2: Backend devices** (AC: #1) — `DeviceTokenRepository`, `DeviceController` under `/alerts/devices`, security rule, exception handling.
- [ ] **Task 3: FCM sender** (AC: #3) — `FcmSender` interface, `GoogleFcmSender` (service-account JWT with jjwt + `java.net.http`), `NoopFcmSender` when unconfigured.
- [ ] **Task 4: Broadcast + resync + revoke** (AC: #2, #4) — rework `NotificationService`, `BroadcastRepository`, controller methods.
- [ ] **Task 5: Backend tests** — devices (register/move/delete/validation/401), broadcast recipients (area by id and by name, push flag, no recipients), FCM sender against a local stub server (message shape, token caching, unregistered token removed), resync (7 days, revoked, expired).
- [ ] **Task 6: Mobile push** (AC: #5, #6) — `firebase_messaging`, `PushService`, Android channel `emergency_alarm` created at start, manifest default channel.
- [ ] **Task 7: History** (AC: #7, #8) — `alert_history` columns + unique `broadcast_id`, `AlertModel` fields, resync, chips, blocked-notification banner.
- [ ] **Task 8: Mobile tests and build** — model/repository/resync/dedupe tests, widget tests, analyze, debug build.
- [ ] **Task 9: Real stack check** — device registration through the gateway, a broadcast with FCM unconfigured (rows + failed), resync endpoint; real push needs the service account (see Dev Notes).

## Dev Notes

- **Credentials:** a real push needs a Firebase **service account key** of project `terrawatch-ac26f` (Firebase console → Project settings → Service accounts → Generate new private key). Save it outside the repo and set `FIREBASE_SERVICE_ACCOUNT_FILE` (mounted into the core-api container). Without it everything else works and the delivery rows say why they failed. Until then the mobile reception can be tested from the Firebase console (Messaging → New campaign → send test message to the device token).
- The notification message carries `channel_id=emergency_alarm`; that channel (siren, alarm usage) is created by the app at start (Story 5.3 siren fix, branch `feature/mobile-emergency-siren`, merged into the mobile branch here).
- Reuse: `ApiClient`, `AlertsRepository`, `NotificationService.triggerEmergencyAlarm`, `LocalStorage.alert_history`, `EmergencyAlertScreen`, `AlertSubscription*` backend classes, `alert_broadcasts/alert_deliveries` from V3.
- **Out of scope:** SMS/cell broadcast delivery, background isolate that saves pushes while the app is dead (the resync covers it), a WebGIS revoke button, per-delivery read receipts, topics.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: docs/API_SPECIFICATION.md]
- [Source: services/core-api/src/main/resources/db/migration/V3__rainfall_terrain_forecast_schema.sql (alert_broadcasts, alert_deliveries)]
- [Source: CONTRIBUTING.md#1] branch `feature/<role>-<feature-name>`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

### File List
