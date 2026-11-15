import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Mocked API. reviewkpi.spec.js already covers the KPI strip and the happy-path summary; this file covers the log itself.

const METRICS = { windowDays: 7, approved: 1, rejected: 1, avgMinutes: 42, medianMinutes: 30, expiredUnreviewed: 0 };
const LOG = [
  { reviewId: 901, runId: 'run-aaa', unitId: 'unit-sapa', hazardLevel: 'extreme', decision: 'approved', reviewerName: 'Cán bộ An', reviewerEmail: 'an@e2e.test', reviewerRole: 'officer', reasonNotes: 'Mưa đo thực tế khớp dự báo', reviewedAt: '2026-10-10T03:00:00Z' },
  { reviewId: 902, runId: 'run-bbb', unitId: 'unit-muc', hazardLevel: 'high', decision: 'rejected', reviewerName: 'Cán bộ Bình', reviewerEmail: 'binh@e2e.test', reviewerRole: 'officer', reasonNotes: 'Không có mưa thực đo', reviewedAt: '2026-10-10T04:00:00Z' }
];

async function openAudit(page, { log = LOG, auditStatus = 200, metricsStatus = 200 } = {}) {
  const calls = await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/forecasts/reviews/audit') return [auditStatus, auditStatus === 200 ? log : { message: 'x' }];
    if (path === '/forecasts/reviews/metrics') return [metricsStatus, metricsStatus === 200 ? METRICS : {}];
  });
  await page.goto('/');
  await openTool(page, 'Nhật ký thẩm định');
  await expect(page.getByRole('heading', { name: 'NHẬT KÝ THẨM ĐỊNH DỰ BÁO' })).toBeVisible();
  return calls;
}

test('lists decisions with reviewer, hazard, note and ids', async ({ page }) => {
  const calls = await openAudit(page);
  await expect(page.getByText('ĐÃ PHÊ DUYỆT', { exact: true })).toBeVisible();
  await expect(page.getByText('ĐÃ BÁC BỎ', { exact: true })).toBeVisible();
  await expect(page.getByText('EXTREME', { exact: true })).toBeVisible();
  await expect(page.getByText('unit-sapa')).toBeVisible();
  await expect(page.getByText('Cán bộ An')).toBeVisible();
  await expect(page.getByText('(an@e2e.test)')).toBeVisible();
  await expect(page.getByText('Mưa đo thực tế khớp dự báo')).toBeVisible();
  await expect(page.getByText('Mã chạy: run-bbb')).toBeVisible();
  await expect(page.getByText('Mã kiểm toán: #902')).toBeVisible();
  expect(calls.filter((c) => c.path === '/forecasts/reviews/audit').map((c) => c.method)).toEqual(['GET']);
});

test('decision filter and search narrow the list', async ({ page }) => {
  await openAudit(page);
  await page.getByRole('combobox').selectOption('rejected');
  await expect(page.getByText('unit-muc')).toBeVisible();
  await expect(page.getByText('unit-sapa')).toHaveCount(0);
  await page.getByRole('combobox').selectOption('ALL');
  await page.getByPlaceholder(/Tìm theo mã ô đánh giá/).fill('binh@e2e');
  await expect(page.getByText('unit-muc')).toBeVisible();
  await expect(page.getByText('unit-sapa')).toHaveCount(0);
  await page.getByPlaceholder(/Tìm theo mã ô đánh giá/).fill('không-khớp-gì');
  await expect(page.getByText('Không có dữ liệu thẩm định nào phù hợp với bộ lọc.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất CSV' })).toBeDisabled();
});

test('empty log shows the empty state and disables CSV export', async ({ page }) => {
  await openAudit(page, { log: [] });
  await expect(page.getByText('Không có dữ liệu thẩm định nào phù hợp với bộ lọc.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất CSV' })).toBeDisabled();
});

test('a 403 on the log shows the permission message', async ({ page }) => {
  await openAudit(page, { auditStatus: 403 });
  await expect(page.getByText('Không tải được nhật ký thẩm định')).toHaveCount(0); // the 403 text replaces the fallback
  await expect(page.getByText('Tài khoản không có quyền thẩm định dự báo.')).toBeVisible();
});

test('a failed metrics call shows a warning in the summary but the log still lists', async ({ page }) => {
  await openAudit(page, { metricsStatus: 500 });
  await expect(page.getByLabel('Tóm tắt hiệu quả thẩm định').getByRole('alert')).toHaveText('Không tải được số liệu tổng hợp.');
  await expect(page.getByText('unit-sapa')).toBeVisible();
});

test('CSV export downloads the rows currently shown', async ({ page }) => {
  await openAudit(page);
  await page.getByRole('combobox').selectOption('approved');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/nhat-ky-tham-dinh.*\.csv$/);
  const text = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
  expect(text).toContain('unit-sapa');
  expect(text).not.toContain('unit-muc');
});
