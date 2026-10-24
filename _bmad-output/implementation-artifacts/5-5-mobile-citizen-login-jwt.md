---
baseline_commit: 093c52f
---
# Story 5.5: Mobile citizen login with JWT

Status: review

## Story

As a Citizen,
I want to log in (and register) from the mobile app and stay signed in,
so that my subscriptions, device token and field reports are tied to my account.

**Epic:** Epic 5: Mobile and end-to-end verification
**Sprint key:** `5-5-mobile-citizen-login-jwt`
**Target app:** `apps/mobile/` (Flutter, branch `feature/mobile-login-auth`)
**Owner:** Lâm. Backend dependency: Story 1.1 (done, Thuận/Duẫn).
**Scope note:** Supports Story 5.1 (`userId` for subscription/device token) and 5.2. Added as a sub-story because `lam-mobile/epics.md` lists "citizen login" under responsibilities but no story carried it.

## Acceptance Criteria

1. **AC1 — Login:** `POST /api/v1/auth/login` with `{email, password}` returns `{token, role, user}`. On success the app stores token + user profile and shows the main shell (4 tabs).
2. **AC2 — Errors:** `401` shows "Email hoặc mật khẩu không đúng" (no hint which part); `400` shows validation message; network failure shows a connection error. The password is never logged or shown in error text.
3. **AC3 — Register:** `POST /api/v1/auth/register` `{fullName, email, password(min 8), phoneNumber?}` creates a citizen (role is forced server-side) and signs the user in; `409` shows "Email đã được đăng ký".
4. **AC4 — Session persistence:** on app start, a stored token is validated with `GET /api/v1/auth/me` (`Authorization: Bearer`). Valid → main shell; `401`/missing → login screen. Offline with a stored token → main shell using the stored profile (geofencing is local; do not lock the citizen out).
5. **AC5 — Non-citizen roles:** if `role != citizen` the app rejects the login ("Ứng dụng dành cho người dân") and stores nothing.
6. **AC6 — Profile & logout:** the Hồ sơ tab shows the logged-in user's name/email/initials (replacing mock "Hoàng Văn Minh"); "Đăng xuất" clears token + profile and returns to login.
7. **AC7 — Token reuse:** `ApiClient` attaches the Bearer token to every request when logged in; a `401` response from any call clears the session and returns to login. `AlertsRepository.registerDeviceToken` uses the real `userId` instead of `citizen_anonymous`.

## Tasks / Subtasks

- [x] **Task 1: Session storage** (AC: #1, #4, #6)
  - [x] 1.1 Add `shared_preferences` to `pubspec.yaml` (shortcut: plain storage, upgrade to `flutter_secure_storage` before production).
  - [x] 1.2 `core/storage/session_storage.dart`: save/read/clear `token` and `user` JSON.
- [x] **Task 2: Auth data layer** (AC: #1–#3, #5)
  - [x] 2.1 `features/auth/data/auth_models.dart`: `UserProfile`, `AuthResult` with `fromJson` (backend keys: `userId, fullName, email, role, phoneNumber`; response `token, role, user`).
  - [x] 2.2 `features/auth/data/auth_repository.dart`: `login`, `register`, `me`, `logout`, using `ApiClient` + `ApiEndpoints`; map `ApiException.statusCode` to the messages above.
  - [x] 2.3 `ApiClient`: optional token provider → `Authorization` header; on 401 call a session-expired callback. Read backend error `message` field.
- [x] **Task 3: UI & routing** (AC: #1–#4, #6)
  - [x] 3.1 Replace stub `login_screen.dart`: email/password form, validation, loading state, link to register; `register_screen.dart` for fullName/email/phone/password.
  - [x] 3.2 `app.dart`: startup gate (splash → `MainShell` or `LoginScreen`) per AC4.
  - [x] 3.3 `profile_screen.dart`: real name/email/initials + working logout. Keep Tú's layout/theme.
- [x] **Task 4: Wire token consumers** (AC: #7)
  - [x] 4.1 `AlertsRepository.registerDeviceToken` / `subscribeAlerts` pass the logged-in `userId`.
- [x] **Task 5: Tests** (all ACs)
  - [x] 5.1 Model parsing test, repository tests with a mock `http.Client` (success, 401, 409, network error, non-citizen role), widget test for login validation.
  - [x] 5.2 `flutter analyze` clean, `flutter test` green.

## Dev Notes

- **Backend contract** (verified in code, `services/core-api`): `AuthController` `/api/v1/auth/{register,login,me}`; `LoginRequest(email ≤150, password ≤72)`, `RegisterRequest(fullName ≤100, email, password 8–72, phoneNumber ≤20)`; `AuthResponse(token, role, user)`; errors are `{ "message": "..." }` (`AuthExceptionHandler`). `/register` returns 201. Role values lowercase (`citizen|officer|admin`). Gateway nginx already routes `/api/v1/auth/` (do not hit core-api directly).
- **Existing mobile code to reuse/modify** (read before editing): `core/network/api_client.dart` (GET/POST return `Map`, throws `ApiException`; 401 currently hard-coded message), `core/network/api_exceptions.dart`, `core/constants/api_endpoints.dart` (login/register/me already defined), `core/config/env.dart` (`API_BASE_URL`, default `http://10.0.2.2:8080`; physical phone needs `--dart-define=API_BASE_URL=http://<LAN-IP>:8080`), `features/auth/presentation/login_screen.dart` (stub), `features/profile/presentation/profile_screen.dart` (mock data, uses `_SettingsSection` etc.), `features/alerts/data/alerts_repository.dart` (swallows errors; `citizen_anonymous`), `app.dart`, `main.dart` (init notifications + SQLite before `runApp`).
- **Must preserve:** emergency full-screen alert listener lives in `HomeScreen` (kept alive by `IndexedStack` in `MainShell`) — login gate must not break it; offline geofencing must work without login (AC4 offline path).
- **Style:** feature-first folders (`features/<x>/data|presentation`), `AppColors`/`AppTheme` (white/teal), Vietnamese UI strings, no state-management package (use `StatefulWidget`; do not add provider/bloc). Ponytail: no extra abstractions.
- **Security:** never log passwords/tokens; do not put credentials in URLs. Seed users' passwords are unknown (see Story 1.1 Task 4.5) — test with a registered account.
- **Testing:** `flutter_test`, mock `http.Client` via `ApiClient(client:)` constructor (already injectable).
- **Out of scope:** FCM/real device token, subscription endpoint (no backend yet), refresh tokens (backend issues a single 24h JWT), password reset, officer/admin features.

### References

- [Source: _bmad-output/implementation-artifacts/1-1-multi-role-user-registration-authentication-register-login-jwt.md]
- [Source: _bmad-output/planning-artifacts/members/lam-mobile/epics.md#Responsibilities]
- [Source: _bmad-output/planning-artifacts/architecture.md] (Mobile: subscriptions, reports; citizens access own subscriptions/reports)
- [Source: CONTRIBUTING.md#1] branch `feature/<role>-<feature-name>`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Login/register/me wired to `/api/v1/auth/*` via `AuthRepository` + existing `ApiClient`; session in `Session` (SharedPreferences, shortcut noted in code).
- Root gate in `app.dart` listens to `Session.user` (login ↔ MainShell); logout and 401-with-token clear the session. Offline start keeps the stored session (`refreshProfile` ignores network errors).
- Non-citizen roles rejected (AC5); Hồ sơ tab shows real name/email/initials (the mock stats rows remain placeholders, owned by later stories).
- `registerDeviceToken` now sends the logged-in `userId`. Backend `/alerts/*` endpoints still do not exist (unchanged limitation of 5.1).
- Tests: 8 new in `test/auth_test.dart` (mock `http.Client`) + login-form widget test; `flutter analyze` clean, `flutter test` 13/13 green.
- Not verified: real login against the running gateway/core-api and on a physical phone (needs `--dart-define=API_BASE_URL=http://<LAN-IP>:8080` and a registered account).
- Review follow-up applied: malformed backend response (`TypeError`) is mapped to a user-facing error instead of crashing the form.

### File List

- apps/mobile/pubspec.yaml, pubspec.lock (shared_preferences)
- apps/mobile/lib/core/storage/session.dart (new)
- apps/mobile/lib/core/network/api_client.dart (Bearer header, 401 clears session, backend `message`)
- apps/mobile/lib/features/auth/data/auth_models.dart, auth_repository.dart (new)
- apps/mobile/lib/features/auth/presentation/login_screen.dart (rewritten), register_screen.dart (new)
- apps/mobile/lib/app.dart, main.dart, features/profile/presentation/profile_screen.dart, features/alerts/data/alerts_repository.dart
- apps/mobile/test/auth_test.dart (new), widget_test.dart
- _bmad-output/implementation-artifacts/5-5-mobile-citizen-login-jwt.md, sprint-status.yaml; planning-artifacts/epics.md
