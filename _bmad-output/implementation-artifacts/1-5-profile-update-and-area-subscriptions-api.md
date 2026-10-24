---
baseline_commit: 5c0efac
---
# Story 1.5: Profile update and area subscriptions API

Status: review

## Story

As a Citizen,
I want to edit my name, phone and password and choose which monitoring areas alert me (and over which channel),
so that alerts reach me on the right phone for the places I care about.

**Epic:** Epic 1 (identity) / supports Epic 5 (Story 5.1 subscriptions)
**Sprint key:** `1-5-profile-update-and-area-subscriptions-api`
**Target service:** Core API, branch `feature/core-profile-subscriptions`. **Consumer:** mobile Story 5.7.

## Acceptance Criteria

1. **AC1 — Update profile:** `PUT /api/v1/auth/me` `{fullName, phoneNumber?}` updates the signed-in user and returns `UserProfileResponse`. `fullName` 1-100 chars (trimmed); `phoneNumber` is empty/null (clears it) or `+?` plus 9-15 digits, else 400.
2. **AC2 — Change password:** `PUT /api/v1/auth/password` `{currentPassword, newPassword(8-72 bytes)}` returns 204 after verifying the current password. A wrong current password returns **400, never 401** (clients treat 401 on an authenticated call as an expired session). Accounts with `authProvider = google` get 400.
3. **AC3 — Provider flag:** `UserProfileResponse` carries `authProvider` (`email` | `google`), stored in `users.auth_provider` (default `email`; Google-created accounts are `google`). The value is `email`, not `password`, because the Story 1.1 tests forbid the literal `"password"` in response bodies.
4. **AC4 — Subscriptions:** `GET /api/v1/alerts/subscriptions` lists the user's active subscriptions (`subscriptionId, areaId, areaName, alertChannels, subscribedAt`); `POST` `{areaId, alertChannels[PUSH|SMS], phoneNumber?}` subscribes or, for an area already subscribed, updates its channels (no duplicate row); `DELETE /{id}` removes it (204).
5. **AC5 — Rules:** unknown/inactive area → 404; `SMS` requires a phone (in the request, which is then saved to the profile, or already on the profile) else 400; deleting another user's subscription → 404 (indistinguishable from a missing id).
6. **AC6 — Security:** `PUT /auth/me`, `PUT /auth/password` and everything under `/api/v1/alerts/**` require a valid JWT (401 otherwise); identity comes from the token, never from the body. Gateway routes `/api/v1/alerts`. Existing public routes unchanged.
7. **AC7 — Schema:** migration `V5` adds `users.auth_provider`, makes `alert_subscriptions.province` nullable, adds `area_id` (FK to `gis_schema.monitoring_areas`), `channel_push`, `channel_sms` and a unique index on `(user_id, area_id)`; copied to `database/migrations/`.

## Tasks / Subtasks

- [x] **Task 1: Schema and entities** (AC: #3, #7) — `V5__profile_and_area_subscriptions.sql` (both dirs), `User.authProvider`, `AlertSubscription` entity, `AlertSubscriptionRepository`.
- [x] **Task 2: Profile endpoints** (AC: #1-#3) — `AuthService.updateProfile/changePassword`, `AuthController` `PUT /me` and `PUT /password`, DTOs `UpdateProfileRequest`, `ChangePasswordRequest`; `UserProfileResponse.authProvider`; Google users stamped `google`.
- [x] **Task 3: Subscriptions** (AC: #4, #5) — `AlertSubscriptionService`, `AlertSubscriptionController`, `SubscriptionRequest/Response`.
- [x] **Task 4: Security and gateway** (AC: #6) — `SecurityConfig` matchers, `gateway/nginx.conf` `location /api/v1/alerts`.
- [x] **Task 5: Tests** (all ACs) — `ProfileAndSubscriptionServiceTest` (6) and `ProfileAndSubscriptionApiTest` (3 MockMvc integration tests against the test database). Full suite 32/32.

## Dev Notes

- Test DB is the dedicated `auth_story_1_1_test` (see `src/test/resources/application.properties`); Flyway runs V5 there. Run via `maven:3.9-eclipse-temurin-17-alpine` on the compose network.
- **Deferred:** real FCM device-token registration and push sending (needs `firebase_messaging` on mobile and a sender on the server); radius preference (not in PRD); a `GET` of "my community reports" (Story 5.2).
- Accounts created through Google before this migration show `authProvider = email`; fix with `UPDATE core_schema.users SET auth_provider='google' WHERE ...` if needed.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Initial value `password` for the provider flag broke three Story 1.1 tests (they forbid `"password"` in bodies); renamed to `email`.
- Editing V5 after it ran on the test DB needs a fresh test DB (Flyway checksum); the migration is unreleased so editing it was safe.
- Not verified: behaviour against the live docker database and from the mobile app (done in mobile Story 5.7).

### File List

- services/core-api/src/main/resources/db/migration/V5__profile_and_area_subscriptions.sql, database/migrations/V5__profile_and_area_subscriptions.sql
- services/core-api/src/main/java/vn/terrawatch/core/entity/User.java, AlertSubscription.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/repository/AlertSubscriptionRepository.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/dto/UpdateProfileRequest.java, ChangePasswordRequest.java, SubscriptionRequest.java, SubscriptionResponse.java (new), UserProfileResponse.java
- services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java, GoogleAuthService.java, AlertSubscriptionService.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/controller/AuthController.java, AlertSubscriptionController.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/config/SecurityConfig.java, gateway/nginx.conf
- services/core-api/src/test/java/vn/terrawatch/core/service/ProfileAndSubscriptionServiceTest.java, controller/ProfileAndSubscriptionApiTest.java (new)
- _bmad-output/implementation-artifacts/1-5-profile-update-and-area-subscriptions-api.md, sprint-status.yaml
