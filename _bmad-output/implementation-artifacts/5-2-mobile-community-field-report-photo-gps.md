---
baseline_commit: e622085
---
# Story 5.2: Mobile field reports (photo + GPS, offline queue)

Status: review

## Story

As a Citizen,
I want to report a landslide sign with a photo, my position and the time I saw it, even with no signal,
so that officers receive my evidence once I am online again, without duplicates.

**Epic:** Epic 5: Mobile and end-to-end verification
**Sprint key:** `5-2-mobile-community-field-report-photo-gps`
**Target app:** `apps/mobile/`, branch `feature/mobile-field-reports`. **Backend:** Story 2.4 (`feature/core-field-report-photos`), already implemented and tested.

## Acceptance Criteria

1. **AC1 — Report form:** the report screen lets the citizen take a photo (camera) or choose one from the gallery, shows a preview, shrinks it (max 1280 px, quality 70, must stay ≤ 700 KB or the user is told to pick another), captures GPS on an explicit "Lấy vị trí" tap (with the accuracy; the position is only sent when the report is sent), sets the time the event was seen (default now, never in the future) and a description (≤ 2000). A report needs a location and a photo or a description.
2. **AC2 — Send online:** the app generates a `clientReportId` (UUID v4), uploads the photo (`POST /community-reports/photos`) then posts the report (`POST /community-reports`) with `observedAt` in UTC; the server's 201/200 marks it sent and stores the server `reportId`.
3. **AC3 — Offline queue:** every report is first written to SQLite (`offline_reports`, with the photo bytes, `clientReportId`, `observedAt`, owner `userId`) and then sent. With no network or a 5xx/401 it stays `pending`; nothing is lost. A rejected report (other 4xx) becomes `failed` with the server message and is not retried automatically (the user can retry it by hand).
4. **AC4 — Stable retry:** retries reuse the same `clientReportId` (and the already-uploaded `photoId`), so the server never stores a duplicate. Event time (`observedAt`) and upload time (server `reportedAt`) stay distinct.
5. **AC5 — Auto and manual sync:** pending reports of the signed-in user are sent when the app opens, when it returns to the foreground, after a new report, and on "Gửi lại" / pull-to-refresh. Reports of another account are never sent under the current account.
6. **AC6 — My reports:** a "Báo cáo của tôi" screen lists the user's reports newest first with a thumbnail, time seen, text, and a status (Chờ gửi / Đã gửi / Lỗi + reason; once sent, the server status Đã gửi / Đã xử lý / Đã lưu trữ from `GET /community-reports/mine`). The Profile tab links to it and shows the real count of sent reports.
7. **AC7 — Privacy:** continuous GPS stays local; coordinates leave the phone only when the user sends a report; the form says so.

## Tasks / Subtasks

- [x] **Task 1: Local storage** (AC: #3, #4) — SQLite v3: add columns to `offline_reports` (`client_report_id`, `user_id`, `observed_at`, `accuracy_m`, `image_bytes`, `photo_id`, `server_report_id`, `server_status`, `last_error`) with a safe upgrade for existing installs.
- [x] **Task 2: Data layer** (AC: #2-#5) — `FieldReport` model, `ReportStore` (SQLite implementation), `ReportRepository` (submit, syncPending, retry, refreshStatuses), UUID v4 helper.
- [x] **Task 3: Screens** (AC: #1, #6, #7) — real `report_screen.dart`, new `my_reports_screen.dart`, Profile entry and real sent count.
- [x] **Task 4: Auto sync** (AC: #5) — `MainShell` triggers `syncPending` on start and on resume.
- [x] **Task 5: Tests and build** — unit tests with an in-memory store and a mock HTTP client; widget test for the form; `flutter analyze`, `flutter test`, Android debug build.

## Dev Notes

- **Current state (read from code):** `ReportScreen` is a stub (empty button); `offline_reports` exists with only `latitude, longitude, image_path, description, created_at, status`; `LocalStorage` calls `_createTablesIfNotExist` on every open, `dbVersion` is 2; `image_picker` and `geolocator` are already dependencies and the location permissions are in the manifest.
- **Backend contract (Story 2.4):** `POST /api/v1/community-reports/photos {imageBase64}` → `{photoId, imageUrl}`; `POST /api/v1/community-reports {clientReportId, longitude, latitude, accuracyM?, description?, photoId?, observedAt, observedUntil?}` → 201 new / 200 repeat with `{reportId, clientReportId, status, reportedAt, observedAt, ...}`; `GET /api/v1/community-reports/mine`. Errors keep real statuses (400/404), 401 means expired session.
- **Design choices:** a small `ReportStore` interface so the offline logic is unit-testable without a database; photo bytes live in the SQLite row (about 150-400 KB each after shrinking) so there is no file bookkeeping; no connectivity package, sync is triggered by app events (a background scheduler is out of scope).
- `ApiClient` signs the user out on any 401 while a token is stored: a report must never be sent to an endpoint that can answer 401 for a non-session reason.
- **Out of scope:** background sync while the app is closed, editing a sent report, showing reports on the map, FCM.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]
- [Source: _bmad-output/planning-artifacts/prd.md FR5 (offline report queue with stable IDs; coordinates sent only by explicit user action)]
- [Source: _bmad-output/implementation-artifacts/2-4-community-field-report-api-gps-photo-upload.md]
- [Source: CONTRIBUTING.md#1] branch `feature/<role>-<feature-name>`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Implemented as specified: photo (camera/gallery, shrunk) + explicit GPS + time seen + description; local-first SQLite queue; send = upload photo then post report with a client-generated UUID; retries reuse the id and the uploaded `photoId`; auto sync on app start/resume, after a report, and by pull-to-refresh / "Gửi lại"; "Báo cáo của tôi" list with local and server status; Profile shows the real sent count.
- Offline logic is covered by 9 unit tests with an in-memory store and a fake server (offline then retry without duplicate, no second photo upload, 400 becomes failed and is not retried automatically, 5xx/401 stay pending, sync stops at the first network failure, only the signed-in user's reports are sent, status refresh) and 3 widget tests; `flutter analyze` clean, `flutter test` 50/50.
- **Verified against the real backend** (Story 2.4 on the local stack): registered a throwaway user, ran `ReportRepository` over real HTTP: photo uploaded, report `sent` with a server id, the same `clientReportId` returned the same report (no duplicate), status refresh worked, and the photo URL served `image/png`. Test data removed afterwards.
- Not verified on a phone: camera/gallery picking, the GPS permission flow, the date/time pickers, and a real airplane-mode round trip.

### File List

- apps/mobile/lib/core/constants/app_constants.dart (SQLite v3), core/storage/local_storage.dart (offline_reports columns + safe upgrade)
- apps/mobile/lib/features/report/data/field_report.dart, report_store.dart, report_repository.dart (new)
- apps/mobile/lib/features/report/presentation/report_screen.dart (rewritten), my_reports_screen.dart (new)
- apps/mobile/lib/features/profile/presentation/profile_screen.dart, features/home/presentation/main_shell.dart
- apps/mobile/test/field_report_test.dart, report_screen_test.dart (new)
- _bmad-output/implementation-artifacts/5-2-mobile-community-field-report-photo-gps.md, sprint-status.yaml
