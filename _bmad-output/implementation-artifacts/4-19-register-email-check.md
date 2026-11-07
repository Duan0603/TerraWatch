---
baseline_commit: 95f7c63
---
# Story 4.19: Warn about an already-registered email before the OTP step

Status: review

## Story

As someone signing up on the WebGIS login page,
I want to be told right away that my email already has an account,
so that I do not fill in a whole form, wait for an SMS code and only then get a 409 error.

**Epic:** Epic 4 (with Story 1.1 for auth)
**Sprint key:** `4-19-register-email-check`
**Branch:** `feature/register-email-check` (from `feature/login-slide-panels`). Found by Lâm while signing up with `vuhailam05@gmail.com`.

## Acceptance Criteria

1. **AC1 (API):** `GET /api/v1/auth/email-exists?email=` is public and returns `{"exists": true|false}`; the email is trimmed and lower-cased like register/login; a blank email returns false.
2. **AC2 (inline warning):** when the email field loses focus with a well-formed address that already exists, the field gets a red border and "Email này đã được đăng ký." with a button "Đăng nhập bằng email này" that returns to the sign-in panel with the email filled in.
3. **AC3 (before the SMS):** pressing "Tiếp tục: nhận mã OTP" with a used email stops on step 1, shows the same warning, focuses the email field and sends no OTP (no SMS quota used).
4. **AC4 (edit clears it):** typing in the field removes the warning.
5. **AC5 (fail open):** if the check itself fails (network), the form continues; the server still answers 409 at registration with the clear message from Story 4.7.

## Tasks

- [x] Task 1: `AuthService.emailExists`, `GET /auth/email-exists`, security entry, `AuthControllerTest.emailExistsIsPublicAndNormalisesTheEmail`
- [x] Task 2: `authApi.emailExists`, inline warning on blur, check before sending the OTP, "Đăng nhập bằng email này"
- [x] Task 3: live check through the gateway and the form

## Notes

- Trade-off: the endpoint lets anyone ask whether an email is registered (account enumeration). Register already answers 409 for the same question, the gateway rate-limits the route (50 requests per second per IP), and the app has no secrets tied to the email. If this becomes a concern, add a per-IP limit stricter than the shared one or drop the blur check and keep only the check on submit.
