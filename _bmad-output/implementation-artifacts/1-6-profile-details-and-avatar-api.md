---
baseline_commit: 2a69bc9
---
# Story 1.6: Profile details, emergency contact and avatar API

Status: review

## Story

As a Citizen,
I want to keep my basic personal details, home address, an emergency contact and a profile picture on my account,
so that the system knows where I live and who to reach, and my profile feels complete.

**Sprint key:** `1-6-profile-details-and-avatar-api`
**Target service:** Core API, branch `feature/core-profile-details` (stacked on `feature/core-profile-subscriptions`, Story 1.5). **Consumer:** mobile Story 5.8.

## Acceptance Criteria

1. **AC1 — Details:** `PUT /api/v1/auth/me` accepts, besides `fullName`/`phoneNumber`: `dateOfBirth` (ISO date, in the past, not before 1900-01-01), `gender` (`male|female|other`), `province`, `district`, `commune`, `addressLine`, `emergencyContactName`, `emergencyContactPhone` (same phone rule), `emergencyContactRelation`. All optional and bounded in length.
2. **AC2 — Replace semantics:** PUT replaces every field; null, missing or blank optional values are cleared (stored as null). Invalid gender, future or ancient birth date, or a bad phone returns 400.
3. **AC3 — Profile response:** `GET /me`, `PUT /me`, login and register return all fields plus `hasAvatar`; dates are ISO strings.
4. **AC4 — Avatar:** `PUT /api/v1/auth/me/avatar` `{imageBase64}` stores a JPEG or PNG (valid base64, ≤ 200 KB decoded, checked by file signature); `GET` returns `{imageBase64}` or 404; `DELETE` removes it (204). Owner only: identity is the token; there is no endpoint to read someone else's avatar.
5. **AC5 — Storage:** the picture is stored in its own table `core_schema.user_avatars`, so ordinary user reads never load it; `users.has_avatar` is the cheap flag. Migration `V6` (copied to `database/migrations/`).
6. **AC6 — Security:** `/api/v1/auth/me/**` requires a JWT (401 otherwise).

## Tasks / Subtasks

- [x] **Task 1: Schema/entities** (AC: #5) — `V6__profile_details_and_avatar.sql`, `User` fields, `UserAvatar` + `UserAvatarRepository`.
- [x] **Task 2: Details** (AC: #1-#3) — `UpdateProfileRequest`, `UserProfileResponse`, `AuthService.updateProfile`.
- [x] **Task 3: Avatar** (AC: #4, #6) — `UserAvatarService`, `ProfileAvatarController`, `AvatarRequest/Response`, `SecurityConfig` matcher.
- [x] **Task 4: Tests** (all ACs) — `ProfileDetailsApiTest` (3 MockMvc integration tests); updated `ProfileAndSubscriptionServiceTest`. Full suite 35/35.

## Dev Notes

- Personal data (birth date, address, emergency contact) is optional and only the owner can read it; the existing app privacy note still holds (no continuous GPS goes to the server).
- shortcut: avatar as base64 text in Postgres (client shrinks it to about 256 px / under 200 KB); move to object storage if pictures grow.
- Province, district and commune are free text (no administrative-division dataset in the project); a dropdown would need one.
- Existing `PUT /me` callers must now send the new fields too, otherwise they are cleared; mobile Story 5.8 always sends the full form.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Full backend suite 35/35 against the dedicated test database (Flyway V1-V6).
- Not verified: behaviour from the mobile app on a phone (Story 5.8).

### File List

- services/core-api/src/main/resources/db/migration/V6__profile_details_and_avatar.sql, database/migrations/V6__profile_details_and_avatar.sql
- services/core-api/src/main/java/vn/terrawatch/core/entity/User.java, UserAvatar.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/repository/UserAvatarRepository.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/dto/UpdateProfileRequest.java, UserProfileResponse.java, AvatarRequest.java (new), AvatarResponse.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java, UserAvatarService.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/controller/ProfileAvatarController.java (new), config/SecurityConfig.java
- services/core-api/src/test/java/vn/terrawatch/core/controller/ProfileDetailsApiTest.java (new), service/ProfileAndSubscriptionServiceTest.java
- _bmad-output/implementation-artifacts/1-6-profile-details-and-avatar-api.md, sprint-status.yaml
