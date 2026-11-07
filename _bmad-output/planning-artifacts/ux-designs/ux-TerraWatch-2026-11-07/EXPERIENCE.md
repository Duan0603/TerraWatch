---
name: TerraWatch Login Experience
status: final
updated: 2026-11-07
design: DESIGN.md
sources:
  - apps/webgis/src/pages/LoginPage.jsx (current behaviour to preserve)
  - _bmad-output/implementation-artifacts/4-6-webgis-honesty-fixes.md (empty form, honest wording)
  - _bmad-output/implementation-artifacts/4-8-officer-registration-request-flow.md (officer request)
  - _bmad-output/planning-artifacts/prd.md (section 3: experimental score, roles)
---

## Foundation

Web, desktop first, must work from 360px wide. React + Vite page; no UI library. Visual identity is in [DESIGN.md](DESIGN.md) (tokens referenced as `{colors.brand}` and so on). Behaviour below is what the page does; any visual choice not stated here follows DESIGN.md. Where a mock and these two files disagree, these files win. Mock: `mockups/login-mock.html`.

## Information Architecture

One public page, `/login`, with two layers:

1. The page: hero (brand, headline, short description, experimental-score note), the sign-in card, and the background scene.
2. Two dialogs opened from the card: **Đăng ký công dân** and **Yêu cầu tài khoản cán bộ**. Both run Step 1 (form) → Step 2 (OTP) → Result. Their logic does not change in this redesign.

Exits: signed in → `/` (dashboard for officer/admin, citizen view for citizens, as today); "Xem demo mô hình" → `/model-demo`.

Closure check: every stated need has a surface (sign in, quick demo accounts, model demo, citizen sign-up, officer request) and each is reachable in at most one click from the card.

## Voice and Tone

Vietnamese, plain and calm, second person without pronoun ("Nhập email", "Vào trung tâm chỉ huy"). No alarm words on this page (no "khẩn cấp", no exclamation marks). Errors say what happened and what to do next. The experimental-score note is stated once, in full: "Hệ thống đang ở giai đoạn thử nghiệm. Điểm nguy cơ là điểm thử nghiệm, chưa phải xác suất đã hiệu chuẩn và chưa thay thế cảnh báo chính thức."

## Component Patterns

- **Sign-in form**: email then password, submit with Enter. The fields start empty (Story 4.6 AC4). Password manager attributes `autocomplete="username"` and `current-password`.
- **Quick demo chips**: one click fills the demo email and the demo password for that role and moves focus to the submit button; it does not sign in by itself. A short hint says they are demo accounts. (The chips are a rehearsal aid; hiding them in production is a later decision, not part of this story.)
- **Ghost button** "Xem demo mô hình…": navigates, never submits the form.
- **Action cards** (sign-up entries): open the matching dialog; the dialog's first field gets focus; Esc and the close button return focus to the row that opened it.
- **Background scene**: purely decorative (`aria-hidden`), never receives focus or pointer events.

## State Patterns

| State | Behaviour |
|---|---|
| Empty | Placeholders only; no pre-filled values. |
| Submitting | Primary button disabled with a spinner and the label "Đang đăng nhập…"; fields read-only. |
| Wrong credentials (401) | Message above the button: "Email hoặc mật khẩu không đúng." Password field cleared and focused. |
| Locked account (403) | Server message shown as is ("Tài khoản đã bị tạm khóa bởi Quản trị viên"). |
| Officer pending / rejected (403) | Server message shown as is ("…đang chờ Quản trị viên phê duyệt"). |
| Server or network error | "Không kết nối được máy chủ. Thử lại sau." with the button re-enabled. |
| Already signed in | Visiting `/login` redirects to `/` (existing behaviour). |
| Reduced motion | No rain, clouds static; everything else identical. |
| Slow or weak device | Rain drop count scales with the viewport area and is capped; animation pauses when the tab is hidden. |

## Interaction Primitives

Keyboard: Tab order is email, password, sign in, model demo, the three chips, the two action cards. Enter in either field submits. Esc closes a dialog. Pointer targets are at least 44px high. Chips and links show the `{colors.focus}` outline on keyboard focus.

## Accessibility Floor

- Text contrast at least 4.5:1 on the glass card (checked for `ink-1/2/3` on `glass`); large headline at least 3:1 over the scene.
- Every input has a visible `label`; errors are announced with `role="alert"` and are not colour-only.
- The scene is hidden from assistive tech and obeys `prefers-reduced-motion`.
- No flashing content (no lightning).
- Page is usable at 200% zoom and 360px width without horizontal scroll.

## Responsive & Platform

- **>900px**: two columns as in DESIGN.md.
- **≤900px**: one column, form first; hero = brand + headline only; description and note below the card; action cards keep the same layout.
- Landscape phones: the page scrolls; the card is never clipped.

## Key Flows

**Flow 1 — Hương, duty officer, Yên Bái, early morning.** She opens the site on a heavy-rain day. (1) The rain and clouds tell her she is in the right place. (2) She types her email and password, presses Enter. (3) The button shows "Đang đăng nhập…". (4) **Climax:** the dashboard opens on the forecast queue with the proposals waiting for review.

**Flow 2 — Lâm, presenting to the thesis committee.** (1) The login is on the projector. (2) He clicks the "Quản trị" chip; the form fills. (3) He presses Enter and the admin console opens. (4) **Climax:** the committee has seen a weather scene, the honesty note and a working sign-in within five seconds, and the "Xem demo mô hình" button is one click away if he wants to show history.

**Flow 3 — Minh, field officer without an account.** (1) He taps "Gửi yêu cầu tài khoản cán bộ" on his phone. (2) He fills in the form, including his unit, and enters the OTP. (3) **Climax:** he sees the request code and the message that he can sign in only after an admin approves. (4) Later, signing in before approval shows the pending message.

## Registration dialogs (Story 4.17)

Both dialogs follow Form → OTP → Result, with a visible 3-step indicator.

- **Form**: fields start empty (no pre-filled unit or area, so a wrong default can never be sent by accident). The phone is a Vietnamese mobile number typed as `09…`; the helper says the OTP goes to it by SMS. Citizen area is optional and says that detailed areas are chosen in the app. Errors show above the fields (`role="alert"`) and the match line below the passwords uses `role="status"`.
- **OTP**: six digit boxes; typing advances, Backspace on an empty box goes back, pasting six digits fills all boxes; the confirm button is disabled until six digits are present. The resend link is available after 60 seconds. "Sửa thông tin" returns to the form with the values kept.
- **Result**: officer sees the request code and that an admin must approve; citizen sees a short confirmation. "Quay lại đăng nhập" closes the dialog.
- **Dialog behaviour**: Esc and the close button close it; clicking the dark overlay closes it; the dialog is `aria-modal` and labelled by its title.
- Removed: the simulated-SMS banner and the "auto-fill OTP" shortcut (Story 4.5 forbids a code shown on screen).

## Transitions (Story 4.18)

The sign-in card and the sign-up are two panels of the **same frame**, not a pop-up.

- **Open**: pressing "Đăng ký công dân" or "Yêu cầu tài khoản cán bộ" slides the sign-in panel out to the left while the sign-up panel slides in from the right (0.55 s). The frame height eases to the new panel height and the frame widens from 440 to 520px on desktop. Focus moves to the first field when the panel arrives.
- **Back** ("Quay lại đăng nhập" link, Esc, or the button on the result step): the reverse; the sign-up form is cleared after it has left the frame.
- **Between steps** (Thông tin → OTP → Hoàn tất): new content slides in from the right going forward and from the left going back (0.38 s) while the height eases.
- The hidden panel is `inert` and `aria-hidden`, so Tab and screen readers only see the visible one.
- **Reduced motion**: no animation; the panels swap at once.

## Forgot password (Story 4.20)

A third panel of the same frame (to the right of the sign-up panel), opened by "Quên mật khẩu?" under the password field; the email typed on the sign-in panel is carried over. There is no e-mail service, so ownership is proved with the phone registered on the account.

- **Step 1 Tài khoản**: email and registered phone only. Pressing "Gửi mã OTP" first asks the server whether this email and phone belong together; if not, the form says so and sends no SMS. Every mismatch (unknown email, other phone, locked or Google-only account) gets the same message.
- **Step 2 Mã OTP**: the same six-box OTP as sign-up. Only a correct code moves on; the new password cannot be typed before the phone is verified.
- **Step 3 Mật khẩu mới**: shown only after the code is right: new password twice (show/hide, live match line) and "Đổi mật khẩu". If the verification has expired by then, the panel returns to step 1 with the message.
- **Step 4 Hoàn tất**: "Đã đặt lại mật khẩu" and a button "Đăng nhập ngay" that returns to the sign-in panel with the email filled in and the password empty.
- If Firebase cannot send an SMS because billing is off, the message says so and names the test number.
- Back link and Esc return to sign-in at any time; the panel is cleared after it has left the frame.
- Limits stated to the user: old sessions stay valid until they expire; an account with no registered phone cannot use this route and must ask an admin.
