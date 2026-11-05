---
baseline_commit: b6bb999
---
# Story 5.8: Mobile profile details, emergency contact and avatar

Status: review

## Story

As a Citizen,
I want to fill in my basic details, home address, an emergency contact and a profile picture,
so that my profile is complete and the system knows where I live and who to reach.

**Sprint key:** `5-8-mobile-profile-details-and-avatar`
**Target app:** `apps/mobile/`, branch `feature/mobile-profile-details` (stacked on `feature/mobile-profile-subscriptions`, Story 5.7)
**Backend:** Story 1.6 (`feature/core-profile-details`).

## Acceptance Criteria

1. **AC1 — View:** the Profile tab shows read-only sections "Thông tin cá nhân" (date of birth dd/MM/yyyy, gender, phone), "Nơi ở" (address joined from village/commune/district/province) and "Liên hệ khẩn cấp" (name, relation, phone). Missing values read "Chưa cập nhật".
2. **AC2 — Edit:** "Chỉnh sửa hồ sơ" edits all of them in three groups. Only the full name is required. Date of birth uses a date picker (1900 to today); gender is Nam / Nữ / Khác / Không nêu; phones are `+?` 9-15 digits; if either the emergency contact name or phone is filled, the other is required. Saving sends the whole form (the server replaces every field) and updates the stored profile.
3. **AC3 — Avatar:** tapping the avatar offers take photo, choose from gallery and, when one exists, delete. The picture is shrunk to 256 px / quality 80 on selection, uploaded as base64, shown from memory, and fetched again when the Profile tab opens on a new session. Logout clears it.
4. **AC4 — Compatibility:** a server that does not return the new fields still parses (all optional, `hasAvatar` false).

## Tasks / Subtasks

- [x] **Task 1: Models** (AC: #1, #4) — `UserProfile` new fields plus `dateOfBirthDisplay`, `genderLabel`, `fullAddress`, `emergencyContactDisplay`; `Session.avatar`; `ApiEndpoints.avatar`.
- [x] **Task 2: Repository** (AC: #2, #3) — `AuthRepository.updateProfile` with all fields, `fetchAvatar`, `uploadAvatar`, `deleteAvatar`.
- [x] **Task 3: Screens** (AC: #1-#3) — rewritten `edit_profile_screen.dart`; `profile_screen.dart` with avatar header and detail sections.
- [x] **Task 4: Tests** (all ACs) — `test/profile_details_test.dart` (6 tests) and updated `profile_subscriptions_test.dart`. `flutter analyze` clean, `flutter test` 30/30.

## Dev Notes

- Province, district and commune are free text because the project has no administrative-division dataset; a dropdown would need one.
- shortcut: the avatar is not persisted on the phone; it is fetched when the Profile tab opens.
- Personal data stays optional and is sent only to the signed-in user's own account.
- Needs the Story 1.6 backend and, for the real error statuses, the exception-handler fix noted there.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Not verified on a physical phone: camera/gallery picking, date picker and the new screens (only analyzer and unit/widget tests).

### File List

- apps/mobile/lib/core/storage/session.dart, core/constants/api_endpoints.dart
- apps/mobile/lib/features/auth/data/auth_models.dart, auth_repository.dart
- apps/mobile/lib/features/profile/presentation/profile_screen.dart, edit_profile_screen.dart
- apps/mobile/test/profile_details_test.dart (new), profile_subscriptions_test.dart
- _bmad-output/implementation-artifacts/5-8-mobile-profile-details-and-avatar.md, sprint-status.yaml
