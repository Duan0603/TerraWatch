---
baseline_commit: e77d139
---
# Story 4.20: Forgot password with a phone OTP

Status: review

## Story

As a citizen, officer or admin who forgot my password,
I want to set a new one by proving I hold the phone registered on my account,
so that I can sign in again without asking someone to edit the database.

**Epic:** Epic 4 (with Story 1.1 for auth)
**Sprint key:** `4-20-forgot-password`
**Branch:** `feature/forgot-password` (from `feature/register-email-check`). Requested by Lâm after losing the password of his own test account.
**Why no e-mail link:** the project has no mail service; Firebase phone OTP already exists (Stories 4.6 and 4.8) and proves phone ownership.

## Acceptance Criteria

1. **AC1 (pre-check):** `POST /api/v1/auth/password-reset/check {email, phoneNumber}` (public) returns `{"eligible": true}` only for an active, password-based account whose registered phone matches (`0912…` and `+84912…` count as the same); otherwise `false`. The web calls it before sending an OTP so a wrong pair costs no SMS.
2. **AC2 (reset):** `POST /api/v1/auth/password-reset {email, phoneNumber, phoneToken, newPassword}` (public) returns 204 and sets the new password only when the Firebase phone token verifies, belongs to the same phone number and that phone is the one on the account. Min length 8, max 72 bytes.
3. **AC3 (no leaks):** every failure (unknown email, other phone, locked account, Google-only account, no phone on the account, bad token) is the same 400 "Email hoặc số điện thoại không khớp với tài khoản nào" (a bad token keeps the verifier's own message, which the web shows as an expired-code hint). Nothing says which part was wrong.
4. **AC3b (effect):** after a reset the old password stops working and the new one signs in; existing JWTs stay valid until they expire (stated in the UI).
5. **AC4 (web):** "Quên mật khẩu?" under the password field opens a third panel in the sign-in frame: form (email carried over, phone, new password twice) → six-box OTP → done with "Đăng nhập ngay" (email filled in, password empty). Back link and Esc return; panel is inert while hidden.
6. **AC5 (honesty):** the screen says an account without a registered phone cannot use this route.

## Tasks

- [x] Task 1: `PasswordResetCheck`/`PasswordResetRequest`, `AuthService.canResetPassword`/`resetPassword`, controller, security entries
- [x] Task 2: `AuthControllerTest.forgotPasswordNeedsTheRegisteredPhoneAndItsOtp`
- [x] Task 3: web: `OtpBoxes` and `FormSteps` extracted, `ForgotPasswordPanel`, third slide, link, API calls
- [x] Task 4: live check

## Notes

- Verified live: pre-check right/wrong phone through the gateway, bad token gives 400, the form refuses a wrong phone without sending an SMS.
- Not verified live: the OTP step and the final reset from the browser. Google showed a reCAPTCHA image challenge to the automated browser, which only a person may solve. A throwaway account `qa.forgot@example.com` (password `Terrawatch@2026`, phone 0900000001, the Firebase test number with code 123456) was left in the dev database for that manual check; delete it afterwards.
- Real SMS to a real number needs the Firebase Blaze plan (error `auth/billing-not-enabled` seen earlier), so only the Firebase test number works until billing is on.
- Risks: SIM swap lets an attacker reset a password (an officer or admin account too); old JWTs are not revoked on reset; the mobile app has no "forgot password" screen yet.
