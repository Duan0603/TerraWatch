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
- **Link rows**: open the matching dialog; the dialog's first field gets focus; Esc and the close button return focus to the row that opened it.
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

Keyboard: Tab order is email, password, sign in, model demo, the three chips, the two link rows. Enter in either field submits. Esc closes a dialog. Pointer targets are at least 44px high. Chips and links show the `{colors.focus}` outline on keyboard focus.

## Accessibility Floor

- Text contrast at least 4.5:1 on the glass card (checked for `ink-1/2/3` on `glass`); large headline at least 3:1 over the scene.
- Every input has a visible `label`; errors are announced with `role="alert"` and are not colour-only.
- The scene is hidden from assistive tech and obeys `prefers-reduced-motion`.
- No flashing content (no lightning).
- Page is usable at 200% zoom and 360px width without horizontal scroll.

## Responsive & Platform

- **>900px**: two columns as in DESIGN.md.
- **≤900px**: one column, form first; hero = brand + headline only; description and note below the card; link-row descriptors stack under their labels.
- Landscape phones: the page scrolls; the card is never clipped.

## Key Flows

**Flow 1 — Hương, duty officer, Yên Bái, early morning.** She opens the site on a heavy-rain day. (1) The rain and clouds tell her she is in the right place. (2) She types her email and password, presses Enter. (3) The button shows "Đang đăng nhập…". (4) **Climax:** the dashboard opens on the forecast queue with the proposals waiting for review.

**Flow 2 — Lâm, presenting to the thesis committee.** (1) The login is on the projector. (2) He clicks the "Quản trị" chip; the form fills. (3) He presses Enter and the admin console opens. (4) **Climax:** the committee has seen a weather scene, the honesty note and a working sign-in within five seconds, and the "Xem demo mô hình" button is one click away if he wants to show history.

**Flow 3 — Minh, field officer without an account.** (1) He taps "Gửi yêu cầu tài khoản cán bộ" on his phone. (2) He fills in the form, including his unit, and enters the OTP. (3) **Climax:** he sees the request code and the message that he can sign in only after an admin approves. (4) Later, signing in before approval shows the pending message.
