import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. The dialog is reached from the evidence panel of a selected forecast ("Chi tiết tiến trình").

const iso = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600e3).toISOString();

async function openComparison(page, extra = {}) {
  const item = forecastItem('run-now', 'Sa Pa - So sánh E2E', 'high', {
    probability: 0.7,
    // the comparison button only renders when there is observed rain evidence
    observedRain: [{ intervalEnd: iso(2), mm: 3.5, source: 'e2e', quality: 'ok' }],
    forecastRain: [{ provider: 'open-meteo', mm24h: 55, issuedAt: iso(1) }],
    priorRuns: [
      { runId: 'run-prev', issuedAt: iso(6), hazardLevel: 'medium', probability: 0.55, reviewStatus: 'approved' },
      { runId: 'run-old', issuedAt: iso(12), hazardLevel: 'low', probability: 0.8, reviewStatus: 'superseded' }
    ],
    ...extra
  });
  item.unit.unitId = 'unit-e2e-1';
  item.unit.slopeMax = 41.26;
  await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/review-queue' ? [item] : undefined));
  await page.goto('/');
  await page.locator('.event-card', { hasText: 'Sa Pa - So sánh E2E' }).click();
  await page.getByRole('button', { name: 'Chi tiết tiến trình' }).click();
  const dialog = page.getByRole('heading', { name: 'SO SÁNH CÁC LẦN DỰ BÁO THEO THỜI GIAN' });
  await expect(dialog).toBeVisible();
  // portal into <body>, no role: scope to its own root so the evidence panel behind it is not matched
  return page.locator('body > div', { has: dialog });
}

test('shows unit facts and every run, newest first, with hazard, review status and score', async ({ page }) => {
  const dlg = await openComparison(page);
  await expect(dlg.getByText('3 chu kỳ dự báo')).toBeVisible();
  await expect(dlg.getByText('unit-e2e-1').first()).toBeVisible();
  await expect(dlg.getByText('24.5° / 41.3°')).toBeVisible();
  await expect(dlg.getByText('ĐỢT DỰ BÁO HIỆN TẠI')).toBeVisible();

  const order = await dlg.getByText(/^Mã chạy: run-/).allTextContents();
  expect(order).toEqual(['Mã chạy: run-now', 'Mã chạy: run-prev', 'Mã chạy: run-old']);
  await expect(dlg.getByText('NGUY HIỂM CAO', { exact: true })).toBeVisible();
  await expect(dlg.getByText('TRUNG BÌNH', { exact: true })).toBeVisible();
  await expect(dlg.getByText('NGUY CƠ THẤP', { exact: true })).toBeVisible();
  await expect(dlg.getByText('Chờ duyệt', { exact: true })).toBeVisible();
  await expect(dlg.getByText('Đã duyệt', { exact: true })).toBeVisible();
  await expect(dlg.getByText('Đã thay thế', { exact: true })).toBeVisible();
  for (const pct of ['70%', '55%', '80%']) await expect(dlg.getByText(pct, { exact: true })).toBeVisible();
});

test('shows the change in score against the previous run', async ({ page }) => {
  const dlg = await openComparison(page);
  await expect(dlg.getByText('+15% so với đợt trước')).toBeVisible(); // 70 - 55
  await expect(dlg.getByText('-25% so với đợt trước')).toBeVisible(); // 55 - 80
});

test('lists partner rainfall forecasts', async ({ page }) => {
  const dlg = await openComparison(page);
  await expect(dlg.getByText('Dự Báo Lượng Mưa 24H từ các nguồn đối tác')).toBeVisible();
  await expect(dlg.getByText('open-meteo')).toBeVisible();
  await expect(dlg.getByText('55 mm', { exact: true })).toBeVisible();
});

test('the close button closes the dialog', async ({ page }) => {
  const dlg = await openComparison(page);
  await dlg.getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'SO SÁNH CÁC LẦN DỰ BÁO THEO THỜI GIAN' })).toHaveCount(0);
});
