---
baseline_commit: 5c0efac
---
# Story 5.7: Mobile profile edit and alert areas

Status: review

## Story

As a Citizen,
I want to see and edit my profile, change my password and manage the areas I get alerts for,
so that alerts reach the right phone for the places I care about, and the Profile tab shows only real data.

**Epic:** Epic 5: Mobile and end-to-end verification (supports Story 5.1)
**Sprint key:** `5-7-mobile-profile-edit-and-alert-areas`
**Target app:** `apps/mobile/` (branch `feature/mobile-profile-subscriptions`)
**Owner:** Lâm. **Backend:** Story 1.5 (`feature/core-profile-subscriptions`).

## Acceptance Criteria

1. **AC1 — Real data only:** the Profile tab shows name, email, phone (or "Chưa có số điện thoại") and initials from the session. The fake notification toggles and the fake "Báo cáo đã gửi" number are removed; "Cảnh báo đã nhận" is the real count from the local alert history.
2. **AC2 — Edit profile:** "Chỉnh sửa hồ sơ" edits full name (required) and phone (optional, `+?` 9-15 digits). Saving calls `PUT /api/v1/auth/me` and updates the stored profile, so the Profile tab refreshes without restarting.
3. **AC3 — Change password:** "Đổi mật khẩu" (current, new ≥ 8, confirmation) calls `PUT /api/v1/auth/password`. A wrong current password shows "Mật khẩu hiện tại không đúng" and **keeps the user signed in**. The entry is hidden when `authProvider = google`.
4. **AC4 — Alert areas:** the tab lists the user's subscribed areas (name + channels) from `GET /api/v1/alerts/subscriptions`, with empty, loading and error states; each row can be removed (`DELETE`); "Thêm vùng" opens the existing subscription screen and the list refreshes on return.
5. **AC5 — Subscription screen is real:** it reads the server's `area_id`/`name`, pre-fills the phone from the profile, requires a phone only when SMS is selected, and shows the server's error instead of faking success. The fake offline area list is removed.
6. **AC6 — Logout race:** a slow startup profile check can no longer sign the user back in after logout (fix from the Google sign-in review, finding 1).

## Tasks / Subtasks

- [x] **Task 1: API client and models** (AC: #2-#4) — `ApiClient.put/delete`, `UserProfile.authProvider`, `SubscribedArea`, `ApiEndpoints.password`.
- [x] **Task 2: Repositories** (AC: #2-#6) — `AuthRepository.updateProfile/changePassword` and token-guarded `refreshProfile`; `AlertsRepository.fetchSubscriptions/deleteSubscription`, `subscribeAlerts` and `fetchMonitoringAreas` rethrow errors.
- [x] **Task 3: Screens** (AC: #1-#5) — rewritten `profile_screen.dart`; new `edit_profile_screen.dart`, `change_password_screen.dart`; `subscription_screen.dart` fixes.
- [x] **Task 4: Tests** (all ACs) — `test/profile_subscriptions_test.dart` (8 tests); removed the old test that silently depended on a live backend. `flutter analyze` clean, `flutter test` 24/24.

## Dev Notes

- Verified the real contract end to end through the gateway with curl against the Story 1.5 backend (update profile, invalid phone 400, subscribe with SMS, list, no-token 401, wrong password 400, change password 204, delete 204); throwaway user removed afterwards.
- Wrong current password is 400 on purpose: `ApiClient` signs the user out on any 401 while a token is stored.
- **Deferred:** FCM device-token registration and push (`registerDeviceToken` in `HomeScreen` still sends a placeholder token that the server does not accept yet); radius preference (not in PRD); "reports sent" statistic (needs a "my reports" endpoint, Story 5.2); editing an existing subscription's channels directly (re-add the area to change them).
- Existing Google accounts created before Story 1.5 are `authProvider = email` until updated in the database.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- `AlertsRepository.fetchMonitoringAreas` used to catch every error and return five fake areas with non-numeric ids; the server expects numeric `area_id`, so the old flow could never subscribe against a real backend. The screen now shows the real error.
- Not verified: the new screens on a physical phone (only analyzer, widget/unit tests and curl against the live API).

### File List

- apps/mobile/lib/core/network/api_client.dart, core/constants/api_endpoints.dart
- apps/mobile/lib/features/auth/data/auth_models.dart, auth_repository.dart
- apps/mobile/lib/features/alerts/data/alert_models.dart, alerts_repository.dart, presentation/subscription_screen.dart
- apps/mobile/lib/features/profile/presentation/profile_screen.dart, edit_profile_screen.dart (new), change_password_screen.dart (new)
- apps/mobile/test/profile_subscriptions_test.dart (new), alert_models_test.dart
- _bmad-output/implementation-artifacts/5-7-mobile-profile-edit-and-alert-areas.md, sprint-status.yaml
