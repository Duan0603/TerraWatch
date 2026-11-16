# Story 4.43: Citizen page answers "is my area safe today?" (status, profile, map, actions)

Status: review

## Story

As a citizen living in a landslide-prone area,
I want the page to tell me every day how risky the rain is where I live, what to do, and to keep my areas and contacts in my profile,
so that the app is useful on a normal day, not only after an officer publishes a warning.

## Context (mentor review with Lâm, 15/11)

The citizen page was a passive list: "Cảnh báo đang hiệu lực (0)" most of the time, a map of all northern Vietnam with unexplained dashed boxes,
a chip "Vùng cảnh báo đã duyệt, còn hiệu lực" that read like a status, the subscription card buried, and the Làng Nủ rain warning
(the most "alive" feature) only reachable from an unlabeled map icon. Lâm approved all seven fixes.

Data already available: every monitored rain point carries 28-year IMERG percentiles (`rain_anomaly`: 72 h and forecast 24 h vs P95/P99/P99.9),
Làng Nủ also carries the Open-Meteo rain-threshold warning (`rain_warning`, Story 4.41).

## Acceptance Criteria

1. "Hôm nay ở khu vực của bạn" sits at the top: one row per area the citizen follows, with the level now and in the next 24 h
   (Bình thường / Theo dõi / Cảnh báo / Nguy hiểm), 72 h rain vs the usual amount there, and one plain-language advice line.
   Level = worst rain point inside the area (or the nearest within 30 km); an area without data says so.
2. No followed area: the card asks the citizen to choose areas (opens the profile); with a known position it suggests the nearest area.
3. "Hồ sơ của tôi" (from the header): name, phone, address, emergency contact, and "Khu vực của tôi" (push/SMS per area). Saved with PUT /auth/me.
4. The map frames the citizen's areas on load, colours each followed area by today's level (others stay thin), has a legend, and
   "Xem trên bản đồ" focuses one area; for Làng Nủ, "Xem dòng bùn đá" opens the rain-warning card.
5. Level Cảnh báo or higher in a followed area: a red action banner on top with what to do, call 112, and call the emergency contact.
6. Plain wording: official officer warnings are labeled as such, no internal terms (Open-Meteo, điểm theo dõi) in citizen text.
7. Làng Nủ becomes monitoring area 4 so citizens can follow it (Flyway V17; renumbered from V16 when main added V16__rename_demo_officer).
8. Tests: unit tests for the status logic, e2e for: levels shown per area, danger banner with calls, onboarding without areas, profile save.

## Tasks

- [x] V17 migration: Làng Nủ monitoring area
- [x] `utils/citizenStatus.js` (+ unit tests)
- [x] `TodayStatusCard`, `CitizenProfileModal` (reuses `AlertSubscriptionsCard`), action banner, header chip
- [x] MapViewer: per-area colour/legend, `focus` and `rainRequest` props (citizen map links)
- [x] e2e `citizen.spec.js`

## Limits

- Only Làng Nủ has the calibrated debris-flow extent; other areas show rain level only. Hoàng Su Phì has no rain point within 30 km.
- Evacuation points are not in the data; the banner gives 112 and the citizen's own emergency contact.
