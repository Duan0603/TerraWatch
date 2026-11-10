import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Story 4.34. Mocked API: the numbers are whatever the server says, the page only formats them.

const METRICS = { windowDays: 7, approved: 18, rejected: 5, avgMinutes: 42, medianMinutes: 30, expiredUnreviewed: 3 };

function handler(extra = {}) {
  return ({ path }) => {
    if (path === '/forecasts/reviews/metrics') return extra.metrics ?? METRICS;
    if (path === '/forecasts/reviews/audit') return [];
  };
}

test('KPI strip shows the review card and the audit dialog shows the summary with a 30-day switch', async ({ page }) => {
  const calls = await mockBackend(page, 'officer', handler());

  await page.goto('/');
  const strip = page.getByLabel('Tổng quan tình hình');
  await expect(strip).toContainText('Thẩm định 7 ngày');
  await expect(strip).toContainText('42 phút');
  await expect(strip).toContainText('78% duyệt · 3 hết hạn chưa duyệt');

  await page.getByRole('button', { name: 'Nhật ký thẩm định' }).click();
  const summary = page.getByLabel('Tóm tắt hiệu quả thẩm định');
  await expect(summary).toContainText('Thời gian duyệt trung bình');
  await expect(summary).toContainText('23'); // 18 approved + 5 rejected
  await summary.getByRole('button', { name: '30 ngày' }).click();
  await expect.poll(() => calls.some((c) => c.path === '/forecasts/reviews/metrics' && c.body === null)).toBe(true);
});

test('with no decisions yet the card shows a dash, not zero minutes', async ({ page }) => {
  await mockBackend(page, 'officer', handler({ metrics: { windowDays: 7, approved: 0, rejected: 0, avgMinutes: null, medianMinutes: null, expiredUnreviewed: 0 } }));

  await page.goto('/');
  const strip = page.getByLabel('Tổng quan tình hình');
  await expect(strip).toContainText('chưa có quyết định');
  await expect(strip).not.toContainText('0 phút');
});

test('a failed metrics call leaves the strip without the card and the queue still works', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/forecasts/reviews/metrics') return [500, { message: 'boom' }];
  });

  await page.goto('/');
  const strip = page.getByLabel('Tổng quan tình hình');
  await expect(strip).toContainText('Chờ thẩm định');
  await expect(strip).not.toContainText('Thẩm định 7 ngày');
});
