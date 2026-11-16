# Story 4.44: Phone OTP sent by our own SMS gateway (no Firebase billing)

Status: review

## Story

As a citizen or officer signing up (or resetting a password by phone),
I want the 6-digit code to reach my real phone number,
so that I can verify my number without the project paying for Firebase Blaze.

## Context (Lâm, 16/11)

Sign-up, officer requests and phone password reset (Stories 4.6, 4.8, 4.20) verify the phone with Firebase Phone Auth.
The Firebase project is on the free Spark plan, so only the test number +84 900 000 001 / 123456 gets a code
(`auth/billing-not-enabled` for real numbers). Blaze needs a card and charges per SMS. Lâm chose option B:
the server makes and checks the code itself and sends it through the existing `SmsSender` (SMS Gateway for Android on his
phone, `SMS_PROVIDER=smsgate`, proven on 15/11). Same pattern as the e-mailed reset code (Story 4.21).

## Acceptance Criteria

1. `POST /api/v1/auth/phone-otp/request {phoneNumber}` (public): VN number (0xxxxxxxxx or +84xxxxxxxxx) gets a 6-digit code by SMS,
   valid 5 minutes. Only the bcrypt hash is stored.
2. Anti-abuse: one code per number per 60 s, at most 5 per number per hour, at most 30 codes per hour in total (protects the SIM).
   Over a limit = 429 with a Vietnamese message. SMS not configured (`SMS_PROVIDER=none`) or the send fails = 503, nothing kept as valid.
3. `POST /api/v1/auth/phone-otp/verify {phoneNumber, code}` (public): right code in time gives a one-time `phoneToken` (valid 10 minutes);
   wrong code counts an attempt, 5 wrong = the code is dead. Every failure is the same 400.
4. Register, officer request and phone password reset accept that `phoneToken` for the same number and use it up (one use).
   Firebase phone tokens are still accepted (mobile app, older clients).
5. WebGIS sign-up and forgot-password send and check the code through these endpoints; no reCAPTCHA, no Firebase for phone.
   Messages: sent, wait before resend, too many, SMS not available.
6. Tests: service unit tests (limits, expiry, attempts, one-use token, failed send), web unit/e2e kept green.
7. Verified live: a real code arrives on a real phone and the account is created with that number.

## Tasks

- [x] V18 migration `core_schema.phone_otp_codes`
- [x] `PhoneOtpRepository` + `PhoneOtpService` (request / verify / consume), endpoints, public in SecurityConfig
- [x] `AuthService.verifiedPhone` + `resetPassword` take our one-time token, else a Firebase phone token
- [x] `authApi.sendSmsOtp/verifySmsOtp` call the backend, drop reCAPTCHA
- [x] Tests, rebuild core-api + webgis
- [ ] Real send to a real phone (waits for Lâm: SMS is paused, SMS_PROVIDER=none)

## Dev Notes

- Token kinds: a token is first looked up as ours (sha-256 in `phone_otp_codes`); if not ours it goes to the Firebase verifier.
- SMS text has no brand: "TerraWatch: ma xac thuc cua ban la 123456, het han sau 5 phut. Khong chia se ma nay." (no diacritics: 1 SMS segment).
- Depends on `SmsGateSender` (uncommitted on `feature/webgis-citizen-alert-subscriptions`), so this story lives on that branch for now.

## Dev Agent Record

- Backend: V18 `phone_otp_codes`, `PhoneOtpRepository`, `PhoneOtpService`, `POST /auth/phone-otp/request|verify` (public),
  `AuthService.tokenPhone` = our one-time token first, else Firebase phone ID token (existing tests and mobile keep working).
- Web: `authApi.sendSmsOtp/verifySmsOtp` call the backend; reCAPTCHA container removed; last right code cached so a retry after a failed
  register does not need a new SMS.
- Tests: `PhoneOtpTest` 7 (limits, expiry, attempts, failed send, bad numbers, one-use token at sign-up), `AuthorizationMatrixTest` routes,
  full core-api suite 1757 run / 0 failed after the matrix fix; web unit tests pass; `e2e/phone-otp.spec.js` 2/2.
- Live (Docker, SMS paused): bad number 400, valid number 503 "Máy chủ chưa bật gửi SMS", migration applied (numbered V18 after the merge with main).
- Known limits: the 30/hour global cap can be used up by someone requesting codes for random numbers (blocks real users for up to an hour,
  costs at most 30 SMS); a per-IP limit would fix it. Two requests in the same instant for one number can both send.
