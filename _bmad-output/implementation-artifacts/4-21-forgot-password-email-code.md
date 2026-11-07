---
baseline_commit: 5bbc08b
---
# Story 4.21: Forgot password with a code sent by e-mail

Status: review

## Story

As a user who forgot my password and cannot receive an SMS (Firebase Blaze is off, or I have no phone on the account),
I want a 6-digit code sent to my e-mail,
so that I can prove the account is mine and set a new password without paying for SMS.

**Epic:** Epic 4 (with Story 1.1 for auth)
**Sprint key:** `4-21-forgot-password-email-code`
**Branch:** `feature/forgot-password-email` (from `feature/forgot-password`, Story 4.20). Chosen by Lâm after SMS to a real number failed with `auth/billing-not-enabled`.

## Acceptance Criteria

1. **AC1 (request):** `POST /api/v1/auth/password-reset/email/request {email}` (public) e-mails a 6-digit code valid 10 minutes. The answer is the same `{"sent": true}` whether or not the e-mail has an account (locked and Google-only accounts get no mail). At most one code per minute and five per hour per account. When no sender account is configured it answers 503 with a Vietnamese message.
2. **AC2 (verify):** `POST .../email/verify {email, code}` checks the latest code (bcrypt hash only stored). Five wrong guesses kill that code. A right code returns a one-time `resetToken` (valid 10 more minutes) and the code cannot be used again.
3. **AC3 (complete):** `POST .../email/complete {email, resetToken, newPassword}` (204) changes the password only with a valid unused token for that account (sha-256 stored); the token works once. Min 8, max 72 bytes.
4. **AC4 (one message):** every failure after "request" is the same 400 "Mã xác nhận không đúng hoặc đã hết hạn".
5. **AC5 (config):** Gmail SMTP via `MAIL_USERNAME` / `MAIL_PASSWORD` (a Gmail "app password") read from the git-ignored `.env` through `docker-compose.yml`; `.env.example` documents them; nothing secret is committed.
6. **AC6 (web):** the forgot-password panel has two tabs, "Nhận mã qua email" (default) and "Nhận mã qua SMS" (Story 4.20). Email flow: email → six-box code → new password (only after the code is right) → done. The OTP step says "nếu email có tài khoản…" (no confirmation that the account exists), mentions Spam, and offers resend after 60 s. A 503 shows the "chưa cấu hình" message.

## Tasks

- [x] Task 1: migration V13 (`password_reset_codes`), `PasswordResetRepository`, `EmailResetService`, `PasswordResetMailer` + SMTP implementation, DTOs, controller routes, security entries, `spring-boot-starter-mail`, `application.yml`, compose and `.env.example`
- [x] Task 2: `EmailResetApiTest` (503, same answer for unknown/locked/Google, code → token → new password, no reuse, 5 wrong guesses, expiry, rate limits)
- [x] Task 3: web tabs, `authApi` calls, `resetErrorMessage` with a node test
- [x] Task 4: live check of the unconfigured path (503 through the gateway and in the form)

## Setup (Lâm, once)

1. Gmail account with 2-Step Verification on. Create an app password at https://myaccount.google.com/apppasswords (16 letters).
2. In the root `.env` (git-ignored) add `MAIL_USERNAME=<gmail address>` and `MAIL_PASSWORD=<the 16 letters, no spaces>`.
3. `docker compose up -d --no-deps core-api`, then try "Quên mật khẩu?" → "Nhận mã qua email".

## Notes

- Not verified live: a real e-mail being delivered (needs the app password). The sender is mocked in tests; the real SMTP path is plain `JavaMailSender`.
- Risks: whoever controls the mailbox can reset the password (including an officer or admin account); old JWTs stay valid up to 24 h; Gmail limits sending to about 500 mails a day; mails may land in Spam.

- Mail design (after Lâm's first real test, the plain text mail looked like spam): multipart mail with a branded HTML part (dark header, large code box, expiry, safety note, no images) plus a plain-text part, sender name "TerraWatch GeoSentry", subject without the code. `SmtpPasswordResetMailerTest` checks the code, the expiry and that the name is HTML-escaped.
