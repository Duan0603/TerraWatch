import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API (officer). The "Lịch sử 7 ngày" tab of the live rain panel reads GET /gis/rainfall/live/history?latitude&longitude&days=7
// with plain fetch. The officer view also gets the model parts (forecast vs actual, GRU score, CSV).
// Not covered: the citizen view (showModel = false) lives on CitizenPage, which another open pull request is rewriting.

const T0 = Date.UTC(2026, 9, 10, 0, 0); // 07:00 in Vietnam
const asOf = (h) => new Date(T0 + h * 3600e3).toISOString();
// 30 hourly slots, hours 10 and 11 were never recorded (server down), hour 3 was filled in later.
const ITEMS = Array.from({ length: 30 }, (_, h) => h).filter((h) => h !== 10 && h !== 11).map((h) => ({
  as_of: asOf(h),
  fetched_at: asOf(h),
  rain_1h_mm: 0.5,
  rain_24h_mm: h === 20 ? 40.5 : 5,
  rain_72h_mm: 12,
  rain_168h_mm: 30,
  forecast_24h_mm: h === 0 ? 10 : h === 1 ? 3 : null,
  quality: 'complete',
  hazard_score: h === 14 ? 0.123 : h === 15 ? 0.4 : null,
  temporal_score: h === 15 ? 0.5 : null,
  model_id: h === 14 || h === 15 ? 'gru-e2e' : null,
  origin: h === 3 ? 'backfill' : 'live'
}));
const BODY = { items: ITEMS, thresholds_24h: { p95: 31.1, p99: 58.5, period: '1998–2026' } };

async function openHistory(page, history = () => BODY) {
  const requests = [];
  // dev builds mount effects twice (React StrictMode): the first fetch is aborted, so only finished requests are counted
  page.on('requestfinished', (r) => { if (r.url().includes('/gis/rainfall/live/history')) requests.push(new URL(r.url())); });
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/forecasts/review-queue') return [forecastItem('run-rain', 'Điểm mưa E2E', 'high')];
    if (path === '/gis/rainfall/live/history') return history();
  });
  await page.goto('/');
  await page.locator('.event-card', { hasText: 'Điểm mưa E2E' }).click();
  await page.getByRole('tab', { name: 'Hiện tại & 7 ngày tới' }).click();
  await page.getByRole('tab', { name: 'Lịch sử 7 ngày' }).click();
  return requests;
}
const history = (page) => page.getByRole('region', { name: 'Lịch sử mưa đã ghi' });

test('asks for 7 days at the selected point and summarises coverage, backfill, gaps and the peak', async ({ page }) => {
  const requests = await openHistory(page);
  await expect(history(page)).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({ latitude: '21.7', longitude: '104.5', days: '7' });

  const cover = history(page).locator('.live-rain-coverage').first();
  await expect(cover).toContainText('28 giờ đã ghi từ');
  await expect(cover).toContainText('trong đó 1 giờ bù sau');
  await expect(cover).toContainText('2 giờ trống vì máy chủ không chạy');
  await expect(cover).toContainText('Mưa 24h cao nhất: 40,5 mm lúc'); // vi-VN decimal comma
  await expect(cover).toContainText('(UTC+7)');
});

test('chart: one line break per gap, dots per recorded hour (backfill marked), threshold lines and an accessible summary', async ({ page }) => {
  await openHistory(page);
  const chart = history(page).locator('svg').first();
  await expect(chart).toHaveAttribute('aria-label', 'Mưa 24 giờ theo từng giờ đã ghi, cao nhất 40,5 mm');
  await expect(chart.locator('.rain-history-dot')).toHaveCount(28);
  await expect(chart.locator('.rain-history-dot.is-backfill')).toHaveCount(1);
  await expect(chart.locator('.rain-history-gap')).toHaveCount(2);
  await expect(chart.locator('.rain-history-line')).toHaveCount(2); // the line is cut where hours 10-11 are missing
  await expect(chart.locator('.rain-history-threshold text')).toHaveText(['95% · 31', '99% · 59']);
  await expect(history(page).locator('figcaption').first()).toContainText('ngưỡng 95% và 99% của nơi này (1998–2026)');
  await expect(chart.locator('.rain-history-gap title').first()).toContainText('không có dữ liệu');
  await expect(history(page)).toContainText('Bù sau');
});

test('officer sees forecast against what happened 24 h later, newest first, with the signed difference', async ({ page }) => {
  await openHistory(page);
  const table = history(page).getByRole('table', { name: 'Dự báo 24 giờ so với mưa ghi được 24 giờ sau' });
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  // issued 08h forecast 3 mm, 24 h later 5 mm: +2 ; issued 07h forecast 10 mm, later 5 mm: -5
  await expect(rows.nth(0)).toContainText('08h 10/10');
  await expect(rows.nth(0)).toContainText('3 mm');
  await expect(rows.nth(0)).toContainText('5 mm');
  await expect(rows.nth(0).locator('td').last()).toHaveText('+2 mm');
  await expect(rows.nth(1)).toContainText('07h 10/10');
  await expect(rows.nth(1).locator('td').last()).toHaveText('-5 mm');
  await expect(history(page)).toContainText('2 cặp.');
});

test('officer sees the GRU score chart with its peak and model, flagged as experimental', async ({ page }) => {
  await openHistory(page);
  await expect(history(page).getByRole('heading', { name: 'Điểm GRU theo giờ' })).toBeVisible();
  await expect(history(page).getByRole('img', { name: 'Điểm GRU theo giờ, cao nhất 0,400' })).toBeVisible();
  await expect(history(page)).toContainText('Cao nhất 0,400 lúc');
  await expect(history(page)).toContainText('mô hình gru-e2e');
  await expect(history(page)).toContainText('Điểm thử nghiệm, chưa phải xác suất.');
});

test('CSV download names the file after the point and holds one row per recorded hour', async ({ page }) => {
  await openHistory(page);
  const [download] = await Promise.all([page.waitForEvent('download'), history(page).getByRole('button', { name: 'Tải CSV (28 giờ)' }).click()]);
  expect(download.suggestedFilename()).toBe('lich-su-mua_21.7000_104.5000.csv');
  const text = (await (await import('node:fs/promises')).readFile(await download.path(), 'utf8')).replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/);
  expect(lines).toHaveLength(29);
  expect(lines[0]).toContain('Giờ dữ liệu (UTC+7)');
  expect(lines[0]).toContain('Điểm GRU');
  expect(text).toContain('gru-e2e');
  expect(text).toContain('bù sau từ lần lấy muộn hơn'); // origin is spelled out, not the raw code
  expect(text).not.toContain('backfill');
});

test('a point with no recorded hours says so, with no chart', async ({ page }) => {
  await openHistory(page, () => ({ items: [], thresholds_24h: null }));
  await expect(page.getByText('Điểm này chưa có giờ nào được ghi. Máy chủ ghi mỗi giờ một lần khi đang chạy.')).toBeVisible();
  await expect(history(page)).toHaveCount(0);
});

test('without thresholds there are no threshold lines; without pairs and scores the officer parts explain why', async ({ page }) => {
  const sparse = [0, 1, 2].map((h) => ({ as_of: asOf(h), fetched_at: asOf(h), rain_24h_mm: 3, forecast_24h_mm: null, hazard_score: null, model_id: null, origin: 'live' }));
  await openHistory(page, () => ({ items: sparse, thresholds_24h: null }));
  await expect(history(page).locator('.rain-history-threshold')).toHaveCount(0);
  await expect(history(page).locator('figcaption').first()).not.toContainText('ngưỡng 95%');
  await expect(history(page)).toContainText('Chưa có cặp nào: cần một giờ đã ghi và đúng 24 giờ sau đó cũng được ghi. Hiện có 3 giờ.');
  await expect(history(page)).toContainText('Chưa có giờ nào có điểm GRU cho điểm này.');
  await expect(history(page).getByRole('button', { name: /Tải CSV \(3 giờ\)/ })).toBeVisible();
});

test('shows a loading status while the server answers', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const requests = await openHistory(page);
  await page.getByRole('tab', { name: 'Hiện tại', exact: true }).click();
  await page.route('**/api/v1/gis/rainfall/live/history**', async (route) => {
    await gate;
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(BODY) });
  });
  await page.getByRole('tab', { name: 'Lịch sử 7 ngày' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đang đọc lịch sử mưa…' })).toBeVisible();
  await expect(history(page)).toHaveCount(0);
  release();
  await expect(history(page)).toBeVisible();
  expect(requests.length).toBeGreaterThanOrEqual(1);
});

test('a server error shows its detail; with no detail a generic message', async ({ page }) => {
  await openHistory(page, () => [503, { detail: 'Kho lịch sử chưa sẵn sàng.' }]);
  await expect(page.getByRole('alert')).toHaveText('Kho lịch sử chưa sẵn sàng.');
  await expect(history(page)).toHaveCount(0);
});

test('a server error without detail shows the generic message', async ({ page }) => {
  await openHistory(page, () => [500, {}]);
  await expect(page.getByRole('alert')).toHaveText('Chưa đọc được lịch sử mưa.');
});

test('switching back to "Hiện tại" and to history again asks the server again', async ({ page }) => {
  const requests = await openHistory(page);
  await expect(history(page)).toBeVisible();
  await page.getByRole('tab', { name: 'Hiện tại', exact: true }).click();
  await expect(history(page)).toHaveCount(0);
  await page.getByRole('tab', { name: 'Lịch sử 7 ngày' }).click();
  await expect(history(page)).toBeVisible();
  expect(requests).toHaveLength(2);
});
