---
name: TerraWatch Login
description: Visual identity of the WebGIS sign-in screen (login page only). A night-storm scene with falling rain and drifting clouds behind a glass sign-in card. The rest of the WebGIS keeps its light teal theme (apps/webgis/src/index.css).
status: final
updated: 2026-11-07
colors:
  sky-top: '#070D1A'
  sky-mid: '#0F1E33'
  sky-low: '#17324A'
  ridge-far: '#0A1626'
  ridge-near: '#060C18'
  ink-1: '#F1F6F8'
  ink-2: '#B4C4CC'
  ink-3: '#8196A1'
  glass: 'rgba(10,18,32,0.74)'
  glass-line: 'rgba(255,255,255,0.14)'
  field: '#0C1626'
  field-line: '#2B4054'
  brand: '#087B70'
  brand-hover: '#0A9185'
  brand-text: '#5FD0C0'
  focus: '#5FD0C0'
  error: '#FCA5A5'
  role-citizen: '#4ADE80'
  role-officer: '#FB923C'
  role-admin: '#F87171'
typography:
  display:
    fontFamily: 'Inter'
    fontSize: clamp(26px, 4.4vw, 52px)
    fontWeight: '800'
    lineHeight: '1.08'
    letterSpacing: -0.02em
  card-title:
    fontFamily: 'Inter'
    fontSize: 22px
    fontWeight: '700'
  body:
    fontFamily: 'Inter'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  hero-text:
    fontFamily: 'Inter'
    fontSize: 17px
    lineHeight: '1.55'
  label:
    fontFamily: 'Inter'
    fontSize: 13.5px
    fontWeight: '600'
  small:
    fontFamily: 'Inter'
    fontSize: 12.5px
rounded:
  md: 10px
  lg: 18px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
components:
  login-card:
    background: '{colors.glass}'
    border: '1px solid {colors.glass-line}'
    radius: '{rounded.lg}'
    padding: '{spacing.6}'
  input:
    background: '{colors.field}'
    border: '1px solid {colors.field-line}'
    foreground: '{colors.ink-1}'
    height: 46px
    radius: '{rounded.md}'
  button-primary:
    background: '{colors.brand}'
    foreground: '#FFFFFF'
    height: 48px
    radius: '{rounded.md}'
  button-ghost:
    foreground: '{colors.brand-text}'
    border: '1px solid rgba(95,208,192,0.4)'
    height: 44px
    radius: '{rounded.md}'
  role-chip:
    background: 'rgba(255,255,255,0.04)'
    border: '1px solid {colors.glass-line}'
    foreground: '{colors.ink-1}'
    height: 44px
    radius: '{rounded.md}'
---

## Brand & Style

The sign-in screen is the first thing the thesis committee and the duty officers see, so it must say "landslide early warning" before anyone reads a word: a stormy night over mountains, rain falling, clouds moving. The mood is calm and serious, not alarming. It is dark and atmospheric here on purpose; the working dashboard behind it stays light and teal, so the login reads as a threshold into the command centre.

Nothing on the page claims a number the system cannot prove. The hero says what the system does ("theo dõi mưa và địa hình, cảnh báo sạt lở 24 giờ tới") and a visible note says the score is experimental (PRD section 3).

## Colors

- **Sky** (`{colors.sky-top}` → `{colors.sky-mid}` → `{colors.sky-low}`): a vertical night gradient. Clouds are blurred blue-grey ellipses lightened from the sky tones, never white.
- **Ridge**: two flat silhouettes (`{colors.ridge-far}`, `{colors.ridge-near}`) that ground the scene. Decorative only.
- **Ink**: `{colors.ink-1}` for headings and field text, `{colors.ink-2}` for body, `{colors.ink-3}` for hints and notes (contrast on the card is at least 4.5:1).
- **Brand**: `{colors.brand}` is the one filled action ("Vào trung tâm chỉ huy"), the same teal as the dashboard's `--primary`. `{colors.brand-text}` is the teal for emphasis words, outlines and focus rings on dark.
- **Role dots**: `{colors.role-citizen}`, `{colors.role-officer}`, `{colors.role-admin}` reuse the risk palette only as small markers on the quick-login chips; they do not mean risk here.
- **Error**: `{colors.error}` for form errors, always with text, never colour alone.

## Typography

Inter (already loaded by the app). The headline is the only large type (`{typography.display}`); the emphasised second half of it uses `{colors.brand-text}`. Form text is 15px, labels 13.5px, nothing on the page is below 12.5px. Vietnamese diacritics need the 1.08 to 1.55 line heights above; do not tighten them.

## Layout & Spacing

Desktop (above 900px): two columns, hero on the left (1.1fr) and the card on the right (0.9fr, max 440px), centred in a 1180px container with `{spacing.7}` gap. At 900px and below: one column, the form comes first. The hero shrinks to the brand mark and a 26px headline; the descriptive paragraph and the experimental-score note move below the card. Page gutters are 16px on phones, 32px on desktop. The card needs no scrolling at 1280x720.

## Elevation & Depth

Depth comes from layers, not shadows: sky, clouds (behind), rain (canvas, in front of clouds), ridges, then the glass card with a 16px backdrop blur and one soft large shadow (`0 24px 60px rgba(0,0,0,.45)`). Where backdrop blur is unsupported the card falls back to `{colors.glass}` at 0.92 opacity.

## Shapes

`{rounded.lg}` (18px) for the card, `{rounded.md}` (10px) for inputs, buttons and chips, `{rounded.full}` for the role dots only.

## Components

- **Login card** (`login-card`): title "Đăng nhập", one-line subtitle, the form, a "Diễn tập nhanh" divider with three chips, then two link rows.
- **Input**: icon inside on the left, 46px high, `{colors.field}` fill. Focus: border `{colors.focus}` plus a 3px ring at 25% opacity. Error: border `{colors.error}` with the message below.
- **Primary button**: full width, 48px, label "Vào trung tâm chỉ huy →". Hover `{colors.brand-hover}`. Loading and disabled states are in EXPERIENCE.md.
- **Ghost button**: "Xem demo mô hình trên dữ liệu lịch sử", outlined teal, 44px.
- **Role chip**: three equal columns, 44px, a 8px dot plus the role name (Công dân, Cán bộ, Quản trị).
- **Action card** (the two sign-up entries): full-width 64px card with `{colors.glass-line}` border and a faint white fill, a 40px rounded icon tile in teal on the left (Smartphone for citizen, UserPlus for officer), a bold 14.5px title with a 12.5px `{colors.ink-3}` description under it, and an arrow on the right. Hover: teal border and tint, arrow moves 3px. Same layout on phones.
- **Rain**: 70 to 220 slanted strokes, alpha 0.12 to 0.42, line width 0.6 to 1.4px, wind tilt about 12 degrees. **Clouds**: three blurred layers drifting 85 to 150 seconds per cycle.
- **Registration dialogs** (citizen and officer, Story 4.17): one shared design on the same tokens as the sign-in card. Overlay with a 6px blur; panel max 540px, `{rounded.lg}`, near-opaque `{colors.glass}`. Header: 44px teal icon tile, 20px title, 13.5px subtitle, close button 40px. Under it a 3-step indicator (Thông tin, Xác minh SĐT, Hoàn tất): current step filled `{colors.brand}`, finished steps teal with a check and a teal connector. Form fields are grouped in labelled sections (teal 12px uppercase legends) with the same `input` as the sign-in card; passwords sit side by side with one show/hide toggle and a live "khớp / chưa khớp" line. The OTP step uses six 52x60px digit boxes (auto-advance, paste a whole code, Backspace goes back). The result step shows a green check, the message and the request code in a dashed box. Browser autofill keeps the dark field fill.

## Do's and Don'ts

- Do keep the scene behind the card readable: rain alpha stays low where the card sits.
- Do stop the rain and the cloud drift for `prefers-reduced-motion: reduce`.
- Do keep the experimental-score note visible on every breakpoint.
- Don't add lightning or screen flashes (WCAG 2.3.1).
- Don't put statistics, "live" claims or fake counters in the hero.
- Don't use pure white clouds or saturated red/orange in the scene: those colours are reserved for risk levels on the dashboard.
- Don't make motion the only carrier of meaning; the page must read fully with the animation off.
