---
baseline_commit: bdcaef8
---
# Story 4.6: WebGIS honesty fixes and server-side OTP check

Status: review

## Story

As an officer, admin or citizen,
I want every label and indicator on the WebGIS to mean what it says, and a phone number to count as verified only when the server has checked it,
so that nothing on screen overstates certainty, freshness or verification.

**Epic:** Epic 4 (with Story 1.1 for registration)
**Sprint key:** `4-6-webgis-honesty-fixes`
**Branch:** `feature/webgis-honesty-fixes` from `main` bdcaef8 (Story 4.5 merged as #59, Story 5.1 mobile as #58). Web owner: Huy (inform before merge); backend: Thuận.

## Acceptance Criteria

1. **AC1 (score wording):** an uncalibrated forecast value is shown as "Điểm thử nghiệm", never "Xác suất", in the queue, cards and evidence panel (PRD §3).
2. **AC2 (expired):** expired runs are not listed under "Chờ duyệt"; they appear under "Tất cả" marked "Đã hết hạn" and cannot be approved.
3. **AC3 (no fake indicators):** the header "Hệ thống trực tuyến" chip reflects the last queue load (online / error, with time) instead of always being green; the sound toggle either plays the existing alert sound on a new high/extreme proposal or is removed.
4. **AC4 (credentials):** the login form starts empty; the demo quick buttons still fill the demo accounts.
5. **AC5 (OTP on the server):** when the web registers a citizen after an OTP, it sends the Firebase phone ID token; `/auth/register` verifies it (signature, project `terrawatch-ac26f`, `phone_number` matches the submitted number) with the existing Firebase token verifier and stores the phone as verified. Calling the API directly without verifying OTP cannot bypass phone verification.

## Tasks / Subtasks

- [x] Task 1: AC1-AC2 queue, card and evidence panel wording; expired filtering
- [x] Task 2: AC3 header status chip and sound toggle
- [x] Task 3: AC4 empty login form
- [x] Task 4: AC5 backend phone-token check with FirebaseIdTokenVerifier and web sends the token; tests
- [x] Task 5: re-test (core-api, webgis tests and build, live check)

## Dev Notes

- Reused `FirebaseIdTokenVerifier` (Story 1.4, `/auth/google`) with new `verifyPhoneToken` method.
- Web Audio API used for real sound generation without external audio dependencies.

## Dev Agent Record

### Agent Model Used

Gemini 3.8 Flash (High)

### Completion Notes List

- **AC1:** In `apps/webgis/src/components/EventCard.jsx`, replaced "Xác suất" with "Điểm thử nghiệm".
- **AC2:** In `apps/webgis/src/components/VerificationQueue.jsx`, excluded expired proposals from the "Chờ duyệt" (pending) tab and badge count. Marked as "Đã hết hạn" and disabled review buttons in `EventCard.jsx` and `DashboardPage.jsx`.
- **AC3:** In `apps/webgis/src/components/Navbar.jsx` and `DashboardPage.jsx`, connected the status chip to `lastLoadedAt` and `loadError` to display real status ("Hệ thống trực tuyến (HH:mm:ss)", "Mất kết nối API", or "Đang kết nối..."). Implemented real siren beep using Web Audio API in `apps/webgis/src/utils/sound.js`, which sounds immediately on user toggle and on high/extreme approved proposals.
- **AC4:** In `apps/webgis/src/pages/LoginPage.jsx`, initialized email and password state as empty strings `''`. Quick demo helper buttons retained for rehearsal/examination demo.
- **AC5:** In `services/core-api/src/main/java/vn/terrawatch/core/security/FirebaseIdTokenVerifier.java`, implemented `verifyPhoneToken` to verify RS256 Firebase phone tokens. In `AuthService.java`, required valid `phoneToken` whenever a phone number is registered, comparing the token phone with the registered phone. In `apps/webgis/src/pages/LoginPage.jsx` and `authApi.js`, passed `idToken` from Firebase phone confirmation as `phoneToken`. Tests in `AuthControllerTest`, `AuthServiceTest`, and `FirebaseIdTokenVerifierTest` all pass.

### File List

- `apps/webgis/src/api/authApi.js`
- `apps/webgis/src/components/EventCard.jsx`
- `apps/webgis/src/components/Navbar.jsx`
- `apps/webgis/src/components/VerificationQueue.jsx`
- `apps/webgis/src/index.css`
- `apps/webgis/src/pages/DashboardPage.jsx`
- `apps/webgis/src/pages/LoginPage.jsx`
- `apps/webgis/src/utils/sound.js`
- `services/core-api/src/main/java/vn/terrawatch/core/dto/RegisterRequest.java`
- `services/core-api/src/main/java/vn/terrawatch/core/security/FirebaseIdTokenVerifier.java`
- `services/core-api/src/main/java/vn/terrawatch/core/service/AuthService.java`
- `services/core-api/src/test/java/vn/terrawatch/core/controller/AuthControllerTest.java`
- `services/core-api/src/test/java/vn/terrawatch/core/security/FirebaseIdTokenVerifierTest.java`
- `services/core-api/src/test/java/vn/terrawatch/core/service/AuthServiceTest.java`
