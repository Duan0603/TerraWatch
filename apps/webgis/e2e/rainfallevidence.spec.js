import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. The "Bằng chứng mưa & địa hình" panel is shown for the selected forecast on the dashboard.
// forecastcomparison.spec.js covers the "Chi tiết tiến trình" dialog opened from it; this file covers the panel itself.

const iso = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600e3).toISOString();

async function openPanel(page, name, extra = {}, unit = {}) {
  const item = forecastItem('run-ev', name, 'high', extra);
  Object.assign(item.unit, unit);
  await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/review-queue' ? [item] : undefined));
  await page.goto('/');
  // expired and superseded runs are not in the default "Chờ duyệt" tab
  await page.getByRole('button', { name: /Tất cả/ }).click();
  await page.locator('.event-card', { hasText: name }).click();
  const panel = page.locator('.evidence-panel');
  await expect(panel).toBeVisible(); // the "Lúc phát hành dự báo" tab is open by default
  return panel;
}

test('observed rain, forecast rain and prior runs: totals, source, missing hours and the change against each prior run', async ({ page }) => {
  const panel = await openPanel(page, 'Bằng chứng đủ - E2E', {
    probability: 0.62,
    observedRain: [
      { intervalEnd: iso(3), mm: 2, source: 'OPEN_METEO', quality: 'ok' },
      { intervalEnd: iso(2), mm: 0.5, source: 'OPEN_METEO', quality: 'ok' },
      { intervalEnd: iso(1), mm: null, source: null, quality: 'missing' }
    ],
    forecastRain: [{ provider: 'open-meteo', providerRunId: 'pr-1', issuedAt: iso(1), mm24h: 55 }],
    priorRuns: [
      { runId: 'prev-1', issuedAt: iso(6), hazardLevel: 'medium', probability: 0.55, reviewStatus: 'approved' },
      { runId: 'prev-2', issuedAt: iso(12), hazardLevel: 'low', probability: 0.8, reviewStatus: 'superseded' },
      { runId: 'prev-3', issuedAt: iso(18), hazardLevel: null, probability: null, reviewStatus: 'rejected' }
    ]
  });
  await expect(panel).toContainText('Bằng chứng mưa & địa hình');
  await expect(panel).toContainText('Bằng chứng đủ - E2E');
  await expect(panel).toContainText('Còn hiệu lực');

  const bar = (label) => panel.locator('div', { has: page.getByText(label, { exact: true }) }).filter({ hasText: /mm|chưa có/ }).last();
  await expect(bar('Đã qua')).toContainText('2.5 mm'); // 2 + 0.5, the missing hour adds nothing
  await expect(bar('Dự báo')).toContainText('55 mm');
  await expect(panel).toContainText('Nguồn mưa đã qua: Open-Meteo · ước tính từ mô hình khí tượng, không phải số đo trạm');
  await expect(panel).toContainText('Thiếu 1/3 khoảng giờ');
  await expect(panel).toContainText('thiếu dữ liệu không phải là không mưa');
  await expect(panel).toContainText('cột cao nhất 2 mm/giờ');

  await expect(panel).toContainText('Lần này');
  await expect(panel).toContainText('62%');
  const prior = (id) => panel.locator('div', { hasText: /^Trước ·/ }).nth(id);
  await expect(prior(0)).toContainText('medium · đã duyệt');
  await expect(prior(0)).toContainText('55% (+7)');
  await expect(prior(1)).toContainText('low · đã bị thay thế');
  await expect(prior(1)).toContainText('80% (-18)');
  await expect(prior(2)).toContainText('n/a · từ chối'); // no hazard level
  await expect(prior(2)).toContainText('—'); // no probability, no delta
  await expect(panel).toContainText('Mưa dự báo open-meteo');
});

test('empty observed list and no forecast rain: says the run cannot be compared, not "no rain"', async ({ page }) => {
  const panel = await openPanel(page, 'Chưa đối chiếu - E2E', { observedRain: [], forecastRain: [] });
  await expect(panel).toContainText('Chưa có mưa đã qua hoặc dự báo được nạp trước giờ phát hành của lần chạy này, nên không thể đối chiếu.');
  await expect(panel).not.toContainText('Mưa 24h trước phát hành vs dự báo 24h tới');
});

test('without any observedRain list (null) neither the comparison nor the cannot-compare note is shown', async ({ page }) => {
  const panel = await openPanel(page, 'Không bằng chứng - E2E', { observedRain: null });
  await expect(panel).not.toContainText('không thể đối chiếu');
  await expect(panel).not.toContainText('Mưa 24h trước phát hành');
  await expect(panel).toContainText('Địa hình ô đánh giá'); // terrain block still there
});

test('observed rain with only dry hours says "không có mưa"; forecast missing shows "chưa có"', async ({ page }) => {
  const panel = await openPanel(page, 'Khô - E2E', {
    observedRain: [{ intervalEnd: iso(2), mm: 0, source: 'e2e', quality: 'ok' }, { intervalEnd: iso(1), mm: 0, source: 'e2e', quality: 'ok' }],
    forecastRain: []
  });
  await expect(panel).toContainText('không có mưa');
  await expect(panel).toContainText('chưa có'); // forecast row
  await expect(panel).toContainText('0 mm'); // observed total
});

test('terrain values, and "—" for the ones the server did not extract; resolution warning is shown', async ({ page }) => {
  const panel = await openPanel(page, 'Địa hình - E2E', { observedRain: null }, { slopeAvg: 24.5, slopeMax: null, elevationAvg: 800, reliefM: 312, effectiveResolutionM: 1000 });
  await expect(panel.getByText('Độ dốc TB:')).toContainText('24.5°');
  await expect(panel.getByText('Độ dốc max:')).toContainText('—');
  await expect(panel.getByText('Độ cao TB:')).toContainText('800 m');
  await expect(panel.getByText('Chênh cao:')).toContainText('312 m');
  await expect(panel).toContainText('Độ phân giải hiệu dụng ≈ 1000 m: đây là vùng đánh giá nguy cơ, không phải vị trí chính xác của một điểm sạt lở.');
});

test('a cell with no terrain at all says the DEM was not extracted', async ({ page }) => {
  const panel = await openPanel(page, 'Không DEM - E2E', { observedRain: null }, { slopeAvg: null, slopeMax: null, elevationAvg: null, reliefM: null });
  await expect(panel).toContainText('Chưa trích xuất địa hình (DEM) cho ô này.');
  await expect(panel.getByText('Độ dốc TB:')).toHaveCount(0);
});

test('contributing factors and input quality are listed as key and value', async ({ page }) => {
  const panel = await openPanel(page, 'Yếu tố - E2E', {
    observedRain: null,
    contributingFactors: { rain_72h: 12.5, slope: 'steep', nested: { a: 1 } },
    inputQuality: { gaps: 2 }
  });
  const factors = panel.getByText('Yếu tố đóng góp', { exact: true }).locator('..') // title and its box share a parent;
  await expect(factors).toContainText('rain_72h');
  await expect(factors).toContainText('12.5');
  await expect(factors).toContainText('steep');
  await expect(factors).toContainText('{"a":1}'); // objects are shown as JSON
  await expect(panel).toContainText('Chất lượng dữ liệu đầu vào');
  await expect(panel).toContainText('gaps');
});

test('state badge: expired outranks everything; no forecast explains the gap; the demo model is called out', async ({ page }) => {
  const expired = await openPanel(page, 'Hết hạn - E2E', { expired: true, observedRain: null, modelVersion: 'demo' });
  await expect(expired).toContainText('Hết hạn');
  await expect(expired).toContainText('Mô hình: demo (dữ liệu demo, không phải kết quả mô hình thật)');
});

test('a run without a forecast shows the reason and that it does not mean low risk', async ({ page }) => {
  const panel = await openPanel(page, 'Thiếu dự báo - E2E', { availability: 'unavailable', unavailabilityReason: 'MODEL_NOT_RELEASED', hazardLevel: null, probability: null, observedRain: null });
  await expect(panel).toContainText('Không có dự báo'); // badge
  await expect(panel).toContainText('Chưa có dự báo cho ô này: Mô hình dự báo 24 giờ chính thức chưa phát hành. Không đồng nghĩa nguy cơ thấp.');
});

test('a superseded run is labelled as replaced', async ({ page }) => {
  const panel = await openPanel(page, 'Thay thế - E2E', { reviewStatus: 'superseded', observedRain: null });
  await expect(panel).toContainText('Đã bị thay thế');
});

test('the collapse toggle hides the panel and opens it again; the tabs switch to the live weather and back', async ({ page }) => {
  const panel = await openPanel(page, 'Đóng mở - E2E', { observedRain: null });
  await page.getByRole('button', { name: 'Thu gọn bảng' }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở bảng' }).click();
  await expect(panel).toBeVisible();

  await page.getByRole('tab', { name: 'Hiện tại & 7 ngày tới' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Dữ liệu mưa cập nhật' })).toBeVisible();
  await page.getByRole('tab', { name: 'Lúc phát hành dự báo' }).click();
  await expect(panel).toBeVisible();
});
