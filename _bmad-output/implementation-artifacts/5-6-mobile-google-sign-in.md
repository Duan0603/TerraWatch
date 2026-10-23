---
baseline_commit: 242db86
---
# Story 5.6: Mobile Google sign-in

Status: review

## Story

As a Citizen,
I want to sign in with my Google account on the mobile app,
so that I can get into TerraWatch without creating or remembering a password.

**Epic:** Epic 5: Mobile and end-to-end verification
**Sprint key:** `5-6-mobile-google-sign-in`
**Target app:** `apps/mobile/` (branch `feature/mobile-google-login`)
**Owner:** Lâm. **Backend dependency (not yet built):** `POST /api/v1/auth/google` in Core API (Thuận/Duẫn).
**Builds on:** Story 5.5 (login/session). Firebase project `terrawatch-defense` (owned by Huy; Google provider enabled, Android app `com.example.geosentry_mobile` registered with debug SHA-1).

## Acceptance Criteria

1. **AC1 — Button:** the login screen shows "Đăng nhập bằng Google" under the email form. Tapping it opens the Google account chooser.
2. **AC2 — Token exchange:** on success the app obtains a Firebase ID token and posts `{ "idToken": "<token>" }` to `POST /api/v1/auth/google`; the response is the same `AuthResponse` (`token`, `role`, `user`) as `/auth/login`, stored through the existing `Session`.
3. **AC3 — Same session behaviour as 5.5:** gate, offline start, Bearer header, 401 handling, logout and citizen-only role check are unchanged. Logout also signs out of Firebase/Google so the next tap shows the account chooser.
4. **AC4 — Errors:** user cancels the chooser → no error message; Google/Firebase failure → "Đăng nhập Google thất bại"; backend unreachable → the shared network error message; backend 404/501 (endpoint not deployed) → "Máy chủ chưa hỗ trợ đăng nhập Google". Tokens are never logged.
5. **AC5 — Config hygiene:** `google-services.json` is git-ignored (not committed); Android `google-services` Gradle plugin applied; `minSdk` ≥ 23.

## Tasks / Subtasks

- [x] **Task 1: Dependencies and Android config** (AC: #5)
  - [x] 1.1 Add `firebase_core`, `firebase_auth`, `google_sign_in` (latest compatible; check `flutter pub add` result).
  - [x] 1.2 Apply `com.google.gms.google-services` in `android/settings.gradle.kts` and `android/app/build.gradle.kts`; set `minSdk` ≥ 23.
  - [x] 1.3 Add `android/app/google-services.json` to `apps/mobile/.gitignore`; document how to obtain it in `apps/mobile/README.md`.
- [x] **Task 2: Google auth service** (AC: #1–#4)
  - [x] 2.1 `features/auth/data/google_auth_service.dart`: initialise Firebase, run the Google sign-in flow, exchange for a Firebase credential, return the Firebase ID token; return null when the user cancels; sign out helper.
  - [x] 2.2 `AuthRepository.loginWithGoogle()`: get the ID token, `POST /api/v1/auth/google`, reuse `_authenticate` handling (citizen-only check, `Session.save`), map 404/501.
  - [x] 2.3 `ApiEndpoints.googleLogin`; `AuthRepository.logout()` also signs out of Google/Firebase.
- [x] **Task 3: UI** (AC: #1, #4)
  - [x] 3.1 Button + "hoặc" divider on `login_screen.dart` (loading state, error text); keep Tú's white/teal style.
  - [x] 3.2 `main.dart` initialises Firebase before `runApp`; app must still start if Firebase init fails (offline geofencing must not depend on it).
- [x] **Task 4: Tests** (all ACs)
  - [x] 4.1 Repository tests with a fake Google token provider and mock `http.Client`: success stores session; cancel returns without error; 404 maps to the "not supported" message; non-citizen rejected.
  - [x] 4.2 `flutter analyze` clean, `flutter test` green.
- [x] **Task 5: Backend contract note**
  - [x] 5.1 Record the endpoint contract (below) in Dev Notes so Core API owners can implement it.

## Dev Notes

- **Flow:** Google account chooser → Firebase `signInWithCredential` → Firebase ID token (`getIdToken`) → `POST /api/v1/auth/google {idToken}` → Core API verifies token (Firebase Admin SDK / Google public keys, `aud` = `terrawatch-defense`), finds or creates user by email with `role = citizen`, returns `AuthResponse`. WebGIS can reuse the same endpoint with `signInWithPopup`.
- **Backend contract (to build, not in this story):** `POST /api/v1/auth/google`, body `{ "idToken": string }`, 200 → `AuthResponse`; 401 invalid/expired token; users table currently has `password_hash NOT NULL` → store a random BCrypt hash or relax the column; never trust an email sent by the client. Route is already covered by gateway `/api/v1/auth/` and `SecurityConfig` must `permitAll` it.
- **Existing code to reuse:** `AuthRepository._authenticate`, `Session`, `ApiClient` (10s timeout, error mapping), `LoginScreen`, `AppColors`/`AppTheme`.
- **Android:** debug SHA-1 `2F:AC:B9:AA:B0:7B:5A:23:50:8B:22:99:0D:B1:C2:9F:AA:5C:40:CB` is registered; each developer machine/release keystore needs its own SHA-1 in Firebase. Config file comes from Firebase console (Project settings → terrawatch-mobile). Keep `google-services.json` out of git.
- **Out of scope:** backend endpoint, WebGIS button, iOS, account linking between email/password and Google accounts, release signing.

### References

- [Source: _bmad-output/implementation-artifacts/5-5-mobile-citizen-login-jwt.md]
- [Source: apps/webgis/src/config/firebase.js] (Firebase project `terrawatch-defense`)
- [Source: CONTRIBUTING.md#1] branch `feature/<role>-<feature-name>`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Flow implemented: Google chooser (`google_sign_in` 7.x) → Firebase credential (`firebase_auth`) → Firebase ID token → `POST /api/v1/auth/google {idToken}` via `AuthRepository.loginWithGoogle()`; reuses `_authenticate` (citizen-only, `Session.save`).
- Cancel returns null without calling the API; 401/404/501 mapped to Vietnamese messages; logout also signs out of Google/Firebase.
- Android: `google-services` plugin 4.5.0 applied only when `google-services.json` exists (verified `flutter build apk --debug` both with and without the file); `minSdk` ≥ 23; `google-services.json` git-ignored.
- `Firebase.initializeApp()` is wrapped in try/catch so offline geofencing and email login never depend on Firebase.
- Tests: 4 new (success, cancel, 404, non-citizen) → `flutter test` 17/17; `flutter analyze` clean.
- **Not verified:** the real Google chooser on the phone and the full flow — the backend endpoint `/api/v1/auth/google` does not exist yet (Thuận/Duẫn). Until then the button ends with "Máy chủ chưa hỗ trợ đăng nhập Google" after a successful Google/Firebase step.

### File List

- apps/mobile/pubspec.yaml, pubspec.lock, .gitignore, README.md
- apps/mobile/android/settings.gradle.kts, android/app/build.gradle.kts
- apps/mobile/lib/core/config/env.dart, core/constants/api_endpoints.dart, main.dart
- apps/mobile/lib/features/auth/data/google_auth_service.dart (new), auth_repository.dart
- apps/mobile/lib/features/auth/presentation/login_screen.dart
- apps/mobile/test/auth_test.dart
- _bmad-output/implementation-artifacts/5-6-mobile-google-sign-in.md, sprint-status.yaml; planning-artifacts/epics.md
