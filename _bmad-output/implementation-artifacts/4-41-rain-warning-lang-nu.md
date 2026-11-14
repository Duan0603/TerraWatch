---
baseline_commit: 943f7f7
---
# Story 4.41: Rain-threshold landslide warning for Làng Nủ (Open-Meteo, per-site, with replay and impact zone)

Status: review

## Story

As an officer, admin or resident,
I want a warning level for Làng Nủ that comes from how unusual the last days of rain are at that exact place,
so that I can see the danger build up before a slide, without a black-box AI or an invented probability.

**Epic:** Epic 4 (WebGIS)
**Sprint key:** `4-41-rain-warning-lang-nu`
**Branch:** `feature/webgis-rain-warning-langnu` (from main 943f7f7). **Local only — no push until Lâm allows.**
**Evidence:** `E:\Do An\TerraWatch-data\analysis\` (outside the repo): `DANH_GIA_CHUC_NANG.md`, `event_backtest.json`, `om_threshold_and_curve.json`.

## Method (decided 14/11 with Lâm, "Cách B")

- Source = Open-Meteo, the same source the live GIS service reads. Thresholds are that point's own 1998–2026 percentiles of rolling rain (P95 watch, P99 warning, P99.9 danger) on 72 h and 120 h; the level is the higher of the two.
- Shown as three facts, no absolute probability: (1) level; (2) "rain now is higher than X% of days since 1998 here"; (3) "at this level, recorded landslides followed at least 1 in N times (7 sites, 1998–2026); last time: …".
- Back-test on the 8 dated cases of the team dataset: 6/8 reach warning or danger, 7/8 reach watch; Làng Nủ 10/9/2024 = danger (247 mm / 72 h vs P99.9 236 mm). Phúc Khánh 13/9/2025 is missed (Open-Meteo 72 mm).
- Impact zone = the 69.4 ha Làng Nủ debris-flow footprint (team dataset, agent-digitised) plus 100 m; people = WorldPop 2025 constrained 100 m (≈145 in the footprint, ≈232 with +100 m). Làng Nủ was resettled after 2024, so this is "people in the zone by WorldPop", not today's residents. OpenStreetMap has no buildings mapped there.

## Acceptance Criteria

1. **AC1 (config):** `scripts/build-rain-warning-sites.py` builds `services/gis-service/app/config/rain_warning_sites.json` from Open-Meteo archive data, the footprint and WorldPop: per site thresholds (24/72/120 h), daily-peak percentile table, level hit rates, last events, impact zone GeoJSON with people estimates, and two replay series (Làng Nủ 9/2024, Phúc Khánh 9/2025).
2. **AC2 (GIS):** a pure `rain_warning(site, hourly)` computes now and next-24 h levels, the percentile and the hit-rate text; the live loop stores it in the payload (`rain_warning`) for configured sites; `GET /api/v1/gis/rainfall/warning/sites` and `GET /api/v1/gis/rainfall/warning/replay/{case}` serve the sites and an hourly replay. Unit tests cover levels, percentile, missing hours and the Yagi replay reaching danger before 06:00 10/9/2024.
3. **AC3 (web):** a map button "Cảnh báo mưa Làng Nủ" flies to the site, draws the impact zone and opens a card with the level, the three facts, a 7-day rain chart with the thresholds, people in the zone, and "Phát lại 9/2024 / 9/2025". Wording says "ước tính theo mưa, không phải xác suất". Unit and e2e tests.
4. **AC4:** no change to the GRU layer, the forecast queue or the existing anomaly panel; the old mislabelled live point (22.35, 104.42) is left untouched and reported to its owner.

## Known limits

Eight dated cases only; landslide records are incomplete, so hit rates are lower bounds. Open-Meteo is a weather-model estimate (~10–25 km), not a gauge; short local storms can be missed. Impact zone is from the 2024 event.

## Result (14/11/2026)

- Live (gateway): Làng Nủ now "Bình thường", 72 h 22,4 mm = higher than 58% of days since 1998.
- Replay Yagi (Open-Meteo): Theo dõi 06:00 8/9, Cảnh báo 17:00 8/9 (~37 h before the ~06:00 10/9 debris flow), Nguy hiểm 03:00 10/9. Replay 9/2025 reaches no level (Open-Meteo 72 mm) and the card says so.
- Map buttons: icon-only below 1800 px of map width (was 1350) and a second row below 1000 px, because the GRU and rain buttons made the row overlap the info card at 1920 px; `maplayout.spec.js` now mocks the GRU layer so the longest row is tested.
- Tests: GIS 26 (6 new), web unit (testRainWarning), e2e 32/32 (2 new). Live screenshots at 1100/1440/1920 px.
- For the owner of the live GRU points: `live_rainfall_locations.json` still has "Bảo Yên - Thung lũng Làng Nủ" at 22.35, 104.42, about 25 km from Làng Nủ; left untouched.
- Buildings (approved by Lâm 14/11): OpenStreetMap and Microsoft Building Footprints have none at Làng Nủ; Google Open Buildings v3 (tile 36d, confidence >= 0.7) gives 86 buildings in the footprint and 126 with +100 m (x 3.5 people/household = 301 / 441, an upper bound since a household often has several structures). `--buildings` option of the config script; the card shows both WorldPop and the building count.
- Card redesign (14/11, after Lâm's review "3 modes look the same"): live vs replay banners and colours; replay milestones (first Theo dõi / Cảnh báo / Nguy hiểm and the reported slide time, clickable), lead-time verdict ("Cảnh báo sớm 37 giờ, Nguy hiểm sớm 3 giờ") or a red "Bỏ sót" box (9/2025, peak 74.6 mm/72 h); chart with level bands, hourly rain bars, day ticks, slide marker and forecast shading; impact zone and method in collapsible sections; switching modes clears the previous replay; the unrelated forecast-zone box is hidden while the card is open. Replays carry `event_utc` / `event_label`.
- `apps/webgis/nginx.conf`: `index.html` is now served with `Cache-Control: no-cache` (Lâm kept seeing the old card after a rebuild because the browser reused the cached page).
- Rework after Lâm's review (14/11 evening): all 7 case points are warning sites (live level dots on the map, site picker), 8 replays (hour-precise or "day only"), impact zones for Làng Nủ, Đoàn 337 (4.8 ha, ~15 people) and Nha Trang (p-gis 43 ha, ~508 people). Zone colour follows the level being shown (colour carried in the GeoJSON so 3D terrain redraws it). "Việc cần làm" per level with the zone's people (Cảnh báo: footprint; Nguy hiểm: footprint + 100 m). Replay milestones = onset of the last rise before the event (a long rainy season dips and rises again), "≥" when the level was already held at the start of the replay. Tests: web unit (4 rain groups), e2e 32/32, GIS 46 (+2 DB tests kept off).
- Rain-dependent extent for Làng Nủ (Lâm: "one zone, but rigorous; the zone must grow with the rain"): `analysis/runout_langnu_*.py` (outside repo) builds 9 rain steps; the config carries `runout` (steps with geometry, people/buildings/roads, calibration). Model: source = 2024 scar above 700 m (steepest fails first, share p grows with 72 h rain), travel angle anchored on the measured 2024 H/L 11.71° and scaled with volume (Corominas 1996), multiple-flow spreading on the 30 m DEM (Flow-R dh 2 m, 8 m on the valley floor). Check at the Yagi peak: IoU 0.551, recall 0.70, precision 0.72; ~60% of the people/houses of the real 2024 area. Web: the zone and the numbers follow the replayed hour; the real 2024 area is a black dashed outline; nothing is drawn below the first step; the camera frames the whole gully; the selected dot follows the shown level; unrelated forecast panels hidden while the card is open.
- Rework v3 (Lâm: the zone missed the village, the model box read the same in all three modes): v2 missed 12.5 of the 22 ha below 250 m. (1) Travel angle now uses the distance along the 2024 track (3207 m, shortest path inside the footprint) instead of the straight line (2964 m): 10.84° instead of 11.71°. (2) Valley-floor deposit fill: cells that drain within 12 cells into a reached floor cell (< 10°) and stand ≤ h above it join the zone (HAND-style), h = 8 m at the Yagi peak (best IoU), scaled with V^1/3. Peak check: IoU 0.598, recall 0.80, precision 0.70, village (< 250 m) recall 0.71 (was 0.43); ~114/140 people and 76/86 houses (was 82/51). Fixed colour, no level colouring. Card: one comparison line per mode (2024 replay: share of the real area covered at the shown rain; 2025 replay: no mapped area, rain only; live: the 2024 check), the model method moved into the single "Cách tính và giới hạn" section.
- Scope cut (Lâm 14/11: "Làng Nủ is the main thing; other sites only if they have Làng Nủ-grade data, 1-2 sites at most"): the config and the map now hold Làng Nủ only (2 replays: 9/2024, 9/2025); the 6 other live rain pins are removed. All 7 dated cases still feed the pooled "1/N" history. Only other candidate: Đoàn 337 (mapped area + hourly time) - needs buildings and its own extent model first.
