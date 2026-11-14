import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Story 4.41. GIS answers are mocked; the card must show the level and the three "Cách B" facts, and the replay the lead time.
const TH = { 24: { p95: 31.1, p99: 58.5, p99_9: 124.1 }, 72: { p95: 78.4, p99: 128, p99_9: 236 }, 120: { p95: 117.5, p99: 181.3, p99_9: 324.4 } };
const ZONE = { type: 'Polygon', coordinates: [[[104.525, 22.12], [104.537, 22.12], [104.537, 22.144], [104.525, 22.12]]] };
const RUNOUT = { calibration: { alpha_2024_deg: 10.84, rain72_peak_mm: 258.1, path_length_m: 3207, deposit_h_m: 8, iou: 0.598, recall: 0.802, precision: 0.702, village_recall: 0.712 },
  truth_2024: { area_ha: 69, people: 140, buildings: 86 },
  steps: [{ rain72_mm: 79.4, area_ha: 6.8, lowest_elev_m: 624, people: 0, buildings: 0, roads_km: 0, alpha_deg: 19.7, geometry: ZONE },
    { rain72_mm: 128, area_ha: 57.9, lowest_elev_m: 219, people: 4, buildings: 1, roads_km: 0.01, alpha_deg: 13.4, geometry: ZONE },
    { rain72_mm: 236, area_ha: 67, lowest_elev_m: 180, people: 79, buildings: 49, roads_km: 1.09, alpha_deg: 11.9, recall_vs_2024: 0.78, geometry: ZONE }] };
const SITES = {
  period: '1998–2026', hit_rate_sites: 7, hit_rates: { watch: { one_in: 887 }, warning: { one_in: 227 }, danger: { one_in: 40 } },
  replays: [{ replay_id: 'lang_nu_2024', label: 'Bão Yagi, tháng 9/2024', site_key: '22.1202,104.5278' }],
  sites: [{ key: '22.1202,104.5278', name: 'Làng Nủ (xã Phúc Khánh, Bảo Yên, Lào Cai)', latitude: 22.1202, longitude: 104.5278, thresholds: TH,
    last_event_at_level: {}, runout: RUNOUT, impact_zone: { label: 'Vùng lũ bùn đá 10/9/2024', footprint: { area_ha: 69.4, people_estimate: 145, buildings: 12, people_from_buildings: 42, geometry: ZONE }, buffer_100m: { area_ha: 147.6, people_estimate: 232, buildings: 30, people_from_buildings: 105, geometry: ZONE } } }]
};
const hourly = Array.from({ length: 192 }, (_, i) => ({ interval_end: new Date(Date.UTC(2026, 10, 7) + i * 3600e3).toISOString(), mm: 0.2, kind: i < 168 ? 'past_estimate' : 'forecast' }));
const LIVE = { success: true, data: { as_of: '2026-11-14T03:00:00Z', hourly, rain_warning: {
  now: { complete: true, level: null, totals_mm: { 24: 4.8, 72: 14.4, 120: 24 }, percent_days_below: 55.2 },
  next_24h: { complete: true, level: null, totals_mm: { 24: 4.8, 72: 14.4, 120: 24 } } } } };
const step = (h, lvl, mm) => ({ interval_end: h, level: lvl, mm: 1, totals_mm: { 72: mm, 120: mm }, percent_days_below: 99 });
const REPLAY = { replay_id: 'lang_nu_2024', label: 'Bão Yagi', event_precision: 'hour', event_utc: '2024-09-09T23:00:00Z', event_label: 'Lũ bùn đá', hours: [step('2024-09-07T22:00:00Z', null, 70), step('2024-09-07T23:00:00Z', 'watch', 84),
  step('2024-09-08T10:00:00Z', 'warning', 129), step('2024-09-09T20:00:00Z', 'danger', 237)] };

test('rain warning card: level, the three facts, people in the zone, and the Yagi replay lead time', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/gis/rainfall/warning/sites') return SITES;
    if (path === '/gis/rainfall/live') return LIVE;
    if (path === '/gis/rainfall/warning/replay/lang_nu_2024') return REPLAY;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cảnh báo mưa Làng Nủ' }).click();
  const card = page.getByRole('region', { name: /Cảnh báo theo mưa Làng Nủ/ });
  await expect(card).toContainText('Bình thường');
  await expect(card).toContainText('cao hơn 55,2% số ngày từ 1998–2026');
  await expect(card.getByRole('note', { name: 'Phạm vi ước tính' })).toContainText('không có phạm vi nguy hiểm');
  await expect(card).toContainText('Đang theo dõi trực tiếp');
  await expect(card.getByRole('note', { name: 'Việc cần làm' })).toContainText('Không cần hành động');
  await expect(card.getByLabel('Chọn điểm cảnh báo')).toHaveCount(0); // Làng Nủ only
  await expect(card).toContainText('không phải xác suất sạt lở');
  await expect(card.getByLabel('So với vụ thật')).toContainText('phủ 80% vùng sạt thật (71% phần bản làng)');
  await card.getByRole('button', { name: /Phát lại: Bão Yagi/ }).click();
  await expect(card).toContainText('Nguy hiểm', { timeout: 10_000 });
  await expect(card).toContainText('Cảnh báo 37 giờ');
  await expect(card.getByRole('note', { name: 'Việc cần làm' })).toContainText('Sơ tán ngay');
  await expect(card.getByRole('note', { name: 'Phạm vi ước tính' })).toContainText('67 ha');
  await expect(card.getByRole('note', { name: 'Phạm vi ước tính' })).toContainText('180 m');
  await expect(card.getByRole('note', { name: 'Việc cần làm' })).toContainText('~79 người, 49 nhà');
  await expect(card.getByLabel('So với vụ thật')).toContainText('mô hình phủ 78% vùng thật');
  await expect(card).toContainText('Đang phát lại');
  await expect(card).not.toContainText('Đang theo dõi trực tiếp');
  // back to live: nothing of the replay is left
  await card.getByRole('button', { name: 'Hiện tại' }).click();
  await expect(card).toContainText('Đang theo dõi trực tiếp');
  await expect(card).not.toContainText('Lên Cảnh báo');
});

test('a missing warning config does not break the map', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/gis/rainfall/warning/sites') return [503, { detail: 'x' }];
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cảnh báo mưa Làng Nủ' }).click();
  await expect(page.getByRole('region', { name: /Cảnh báo theo mưa/ })).toHaveCount(0);
  await expect(page.getByLabel('Tổng quan tình hình')).toContainText('Chờ thẩm định');
});
