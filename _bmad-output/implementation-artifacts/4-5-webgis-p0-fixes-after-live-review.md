---
baseline_commit: 7964862
---
# Story 4.5: WebGIS P0 fixes after the live review

Status: review

## Story

As an officer or admin using the WebGIS (and a citizen using its public pages),
I want the forecast queue, broadcast history, recipient preview, sign-up and citizen view to tell the truth,
so that no screen shows fake success, mislabelled outages or duplicated areas during review and the demo.

**Epic:** Epic 4: Forecast orchestration, WebGIS and warnings
**Sprint key:** `4-5-webgis-p0-fixes-after-live-review`
**Branch:** `feature/webgis-p0-fixes` (Lâm, with the owners' areas noted below; coordinate with Huy, Thuận, Duẫn)
**Source:** live review on 2026-11-07 against `main` 7964862 (web at :5174, core-api/gateway/gis-service rebuilt from `main`).

## Findings this story fixes

1. Core asks AI for `POST /api/v1/forecasts`; the AI service has no such route (404). Every forecast job ends "AI service unavailable (circuit breaker)", which is wrong: the AI is up. (Thuận/Duẫn)
2. Broadcast history lives in `localStorage` only: another browser or machine sees nothing; the backend has no admin list. (Huy/Thuận)
3. The broadcast form shows no recipient count before confirmation (FR4 requires a preview); the SMS segment counter suggests SMS while SMS is not connected; the area list shows every area twice because `database/seed.sql` (container init) and Flyway `V2` both insert the same three monitoring areas and nothing makes names unique. (Huy, data)
4. "Đăng ký tài khoản cán bộ" calls `/auth/register-officer-request`, which does not exist, then shows a fake success with a fake request id. Phone OTP falls back to a mock code shown on screen and `123456` always passes. (Huy)
5. Citizen page says "tại khu vực bạn đăng ký" but shows every approved zone, prints raw `high`/`extreme`, no validity time, and a fixed 300 px list on phones. (Huy)
6. WebGIS Firebase config is hard-coded to the old project `terrawatch-defense`. (Huy)

## Acceptance Criteria

1. **AC1 (AI contract):** AI exposes `POST /api/v1/forecasts` per docs/API_SPECIFICATION.md (`schema_version rainfall-terrain-24h.v1`, `horizon_hours 24`). It never fabricates a score: with no validated snapshot inputs or no released model it returns `availability: unavailable`, `probability/experimental_score/hazard_level: null` and machine-readable `reason_codes`; a malformed request gets 422. Core stores the reason, so a job reads e.g. "SNAPSHOT_NOT_FOUND" instead of "AI service down".
2. **AC2 (history):** `GET /api/v1/notifications/broadcasts` (admin only; officer 403, anonymous 401) lists broadcasts newest first with id, time, area, severity, message, sender, forecast run, recipients, sent, failed and active/revoked status. The web history modal reads it; nothing is written to `localStorage`.
3. **AC3 (preview and areas):** `GET /api/v1/notifications/broadcast/preview?areaId=` (admin only) returns the area name and the number of push subscribers and devices that would be targeted; the web shows it in the confirmation step and blocks sending when it is 0. The counter speaks of the 160-character limit, not SMS segments, while SMS is not connected. Migration `V10` merges duplicate monitoring areas (references moved to the lowest id) and makes area names unique, so a fresh install no longer duplicates them.
4. **AC4 (sign-up honesty):** the officer sign-up no longer fakes success: the form explains that officer accounts are created by an admin. Phone OTP never shows or accepts a mock code; when Firebase phone auth is unavailable the user is told so.
5. **AC5 (citizen view):** text matches the data ("cảnh báo đang hiệu lực", not "khu vực bạn đăng ký"), levels in Vietnamese with validity time, and the list stacks above the map on phones.
6. **AC6 (Firebase):** the web Firebase config comes from `VITE_FIREBASE_*` variables (documented in `.env.example`); when they are missing, phone auth is reported as not configured instead of using the old project.

## Tasks / Subtasks

- [x] Task 1: AI `POST /api/v1/forecasts` + tests (AC1)
- [x] Task 2: Core broadcast list + preview endpoints, security, tests (AC2, AC3)
- [x] Task 3: Migration V10 de-duplicate monitoring areas + test (AC3)
- [x] Task 4: Web history and preview wiring, counter wording (AC2, AC3)
- [x] Task 5: Web sign-up and OTP honesty, Firebase env config (AC4, AC6)
- [x] Task 6: Citizen page text, labels, layout (AC5)
- [x] Task 7: Re-test everything (backend tests, AI tests, web tests, live check in the browser), commit, push the branch (never `main`)

## Dev Notes

- Out of scope (P1, separate stories): admin user management and officer approval queue, AOI editor, field-report screen, forecast-run comparison, review audit view, real-time notifications, citizen self-service on web, producing real forecast scores (needs Tú's snapshots and Duẫn's released model).
- Docker is fragile on this machine: build one image at a time, no repeated Maven test containers, never kill Docker processes.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5 (claude-opus-5-5)

### Completion Notes List

- **AC1** AI `POST /api/v1/forecasts` (services/ai-service/app/main.py) validates `schema_version`/`horizon_hours 24`/timezone (422 otherwise) and returns `availability: unavailable`, null score/level and `reason_codes` (`SNAPSHOT_MISSING` when no snapshot id, always `MODEL_NOT_RELEASED`). Verified live: a job created through the gateway was picked up by the recovery poller and stored `unavailable` with reason `SNAPSHOT_MISSING, MODEL_NOT_RELEASED` (before: 404 then "AI service unavailable (circuit breaker)"). AI tests 8/8 in the running container (4 new + 4 GRU). Real scores still need Tú's snapshots and Duẫn's released model.
- **AC2** `GET /api/v1/notifications/broadcasts` (admin) + web history reads it; nothing written to localStorage; the history modal shows the real error (officer sees "Chỉ tài khoản Admin..." instead of an empty list) and colours the result chip by outcome. Verified live: a test broadcast to a fake device showed "GỬI THẤT BẠI", "0/1 đã nhận", sender and message.
- **AC3** `GET /api/v1/notifications/broadcast/preview?areaId=` (admin) uses the same recipient rule as sending; the form shows "Người nhận dự kiến: N người đăng ký Push, M thiết bị" and the confirmation step blocks sending when M is 0. Counter is "x/160 ký tự", over 160 blocks continuing (FR4), and the three templates fit the limit (one no longer invents "150mm" of rain). Migration V10 merged the duplicate areas (dev DB: 6 to 3) and makes names unique.
- **AC4** Officer self-registration replaced by a note (accounts are created by an admin, Story 1.1 AC1); `registerOfficerRequest` throws instead of faking a request id. Phone OTP never produces or accepts a mock code (`123456` no longer passes); citizen registration no longer fakes an account when offline. The now-unreachable mock-OTP display block in LoginPage was left in place (dead code, harmless; candidate for cleanup).
- **AC5** Citizen page: "Cảnh báo đang hiệu lực", "Mức nguy cơ: Cao", "Hiệu lực đến ... (UTC+7)", empty state says it is not a safety confirmation; list stacks above the map on phones. Not filtered by the citizen's subscribed areas yet (the offline-sync payload has no area of the unit): stated in a code comment.
- **AC6** `src/config/firebase.js` reads `VITE_FIREBASE_*`; missing config is reported ("Xác thực số điện thoại chưa được cấu hình cho web") instead of using the old `terrawatch-defense` project. **Needs the web app config of terrawatch-ac26f in `apps/webgis/.env`** before phone OTP works again.
- Tests: Core API full suite 84/84; new `BroadcastAdminApiTest` (4). WebGIS `npm test` all pass (new `test-broadcast-history.mjs`), `vite build` OK. Live check on :5174 as officer, admin, citizen and at phone width.
- Local environment repairs (not in the diff): the dev and test databases still recorded my unmerged 5.1 migration `V8__device_tokens_and_broadcast_validity`, which stopped core-api (checksum mismatch); both history rows were removed after a backup, so `main`'s V8/V9 ran. A stale copy of that file in `services/core-api/target/classes` was deleted.

### File List

- services/ai-service/app/main.py, services/ai-service/tests/test_forecast_contract.py
- services/core-api: `V10__unique_monitoring_area_names.sql`, `BroadcastHistoryItem`, `BroadcastPreview`, `BroadcastRepository`, `NotificationService`, `NotificationController`, `SecurityConfig`, test `BroadcastAdminApiTest`
- apps/webgis: `src/api/broadcastApi.js`, `src/api/broadcastHistory.js` (new), `src/api/authApi.js`, `src/config/firebase.js`, `src/components/BroadcastModal.jsx`, `src/components/BroadcastHistoryModal.jsx`, `src/components/EventCard.jsx` (export labels), `src/pages/CitizenPage.jsx`, `src/pages/LoginPage.jsx`, `src/index.css`, `.env.example`, `tests/test-broadcast-history.mjs` (new), `tests/run-all-tests.mjs`
- _bmad-output/implementation-artifacts: this story, `sprint-status.yaml`
