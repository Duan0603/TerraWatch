---
baseline_commit: dca2c9c
---
# Story 1.4: Google sign-in token exchange

Status: review

## Story

As a Citizen using the mobile app (and later WebGIS),
I want to sign in with my Google account,
so that I get a TerraWatch session without creating a password.

**Epic:** Epic 1: Foundation, identity and forecast data contracts
**Sprint key:** `1-4-google-sign-in-token-exchange`
**Target service:** Core API (`services/core-api/`), branch `feature/core-google-auth`
**Consumers:** Mobile Story 5.6 (`feature/mobile-google-login`); WebGIS may reuse the same endpoint.

## Acceptance Criteria

1. **AC1 — Endpoint:** `POST /api/v1/auth/google` with `{ "idToken": "<Firebase ID token>" }` returns the same `AuthResponse` (`token`, `role`, `user`) as `/auth/login`. The route is `permitAll` (gateway already forwards `/api/v1/auth/`).
2. **AC2 — Token verification:** the Firebase ID token must be RS256, signed by a key published by Google (`securetoken@system.gserviceaccount.com` x509 certs, cached by `Cache-Control`), `iss = https://securetoken.google.com/<project>`, `aud = <project>`, not expired (60 s skew), non-empty `sub`, `email` present and `email_verified = true`, `firebase.sign_in_provider = google.com`. Anything else → `401 Invalid Google sign-in`. Key-fetch outage with no cached keys → `503`.
3. **AC3 — Identity from the token only:** the email/name come from the verified token claims, never from the request body.
4. **AC4 — Find or create:** existing user (email case-insensitive) → sign in; unknown email → create a `citizen` with a random, never-disclosed BCrypt password hash (so the account can only be entered through Google). Concurrent first sign-in must not create duplicates.
5. **AC5 — Citizen only:** if the matching account is `officer` or `admin`, return `403` (a verified Google email must not be a back door into staff accounts).
6. **AC6 — Config:** project id from `firebase.project-id` (`FIREBASE_PROJECT_ID`, default `terrawatch-defense`); no new dependency (jjwt 0.12.6 already present); the ID token is never logged.

## Tasks / Subtasks

- [x] **Task 1: Verifier** (AC: #2, #3, #6) — `security/FirebaseIdTokenVerifier`, `security/GoogleCertCache`, `firebase.project-id` in `application.yml`.
- [x] **Task 2: Service and endpoint** (AC: #1, #4, #5) — `service/GoogleAuthService`, `dto/GoogleLoginRequest`, `AuthController.google`, `SecurityConfig` matcher, `AuthService.response` made package-private for reuse.
- [x] **Task 3: Tests** (all ACs) — `FirebaseIdTokenVerifierTest` (valid token; wrong audience/issuer/expired/unverified email/non-Google provider; forged signature, unknown kid, tampered, unsigned, garbage; key-fetch failure → 503), `GoogleAuthServiceTest` (creates citizen, signs in existing, refuses officer/admin).

## Dev Notes

- Verification follows Firebase's documented ID-token rules; implemented with jjwt `keyLocator` instead of adding the Firebase Admin SDK (no credentials needed, no new dependency).
- Existing tests keep a dedicated DB (`src/test/resources/application.properties`, `auth_story_1_1_test`); full suite run: 23 tests green (including the 8 `AuthControllerTest` integration tests).
- **Not covered by automated tests:** a real Google-signed token against Google's live certificates (needs the mobile app / a real Google sign-in; unit tests sign with a generated RSA key). Verify end to end once Story 5.6 is run on a device.
- **Out of scope:** WebGIS button, linking Google to an existing password account, staff Google login, revoking Firebase sessions.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5.5 (claude-sonnet-5-5)

### Completion Notes List

- Added `POST /api/v1/auth/google` per AC1–AC6; `mvn test` in `maven:3.9-eclipse-temurin-17-alpine` → 23/23 passing.
- Staff accounts are intentionally excluded from Google sign-in (403).

### File List

- services/core-api/src/main/java/vn/terrawatch/core/security/FirebaseIdTokenVerifier.java, GoogleCertCache.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/service/GoogleAuthService.java (new), AuthService.java
- services/core-api/src/main/java/vn/terrawatch/core/dto/GoogleLoginRequest.java (new)
- services/core-api/src/main/java/vn/terrawatch/core/controller/AuthController.java, config/SecurityConfig.java
- services/core-api/src/main/resources/application.yml
- services/core-api/src/test/java/vn/terrawatch/core/security/FirebaseIdTokenVerifierTest.java, service/GoogleAuthServiceTest.java (new)
- _bmad-output/implementation-artifacts/1-4-google-sign-in-token-exchange.md, sprint-status.yaml
