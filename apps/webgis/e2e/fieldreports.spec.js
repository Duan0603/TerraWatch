import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Mocked API: field report statuses are never changed for real.

const report = (id, status, extra = {}) => ({
  report_id: id, status, longitude: 104.2, latitude: 21.9, description: `Nứt đất ${id}`,
  observed_at: '2026-10-10T03:00:00Z', image_url: null, submitter_name: `Người báo ${id}`, submitter_phone: null, ...extra
});

async function openReports(page, { reports, onCall } = {}) {
  const rows = reports ?? [
    report(11, 'submitted', { submitter_phone: '0911222333', image_url: '/api/v1/community-reports/11/image' }),
    report(12, 'processed'),
    report(13, 'archived', { submitter_name: null }),
    report(14, 'submitted', { longitude: null }) // no GPS: the API layer drops it
  ];
  const calls = await mockBackend(page, 'officer', (c) => {
    if (c.path === '/community-reports' && c.method === 'GET') return rows;
    return onCall?.(c, rows);
  });
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByRole('heading', { name: 'BÁO CÁO HIỆN TRƯỜNG TỪ CỘNG ĐỒNG' })).toBeVisible();
  return { calls, rows, item: (id) => page.locator('div', { has: page.getByText(`#${id}`, { exact: true }) }).last() };
}

const writes = (calls) => calls.filter((c) => c.method === 'PATCH');
const filter = (page) => page.getByRole('combobox');

test('lists reports with status, submitter and GPS; drops reports without coordinates', async ({ page }) => {
  await openReports(page);
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(page.getByText('Chờ xử lý', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Đã xử lý', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Đã lưu trữ', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Người báo 11')).toBeVisible();
  await expect(page.getByText('0911222333')).toBeVisible();
  await expect(page.getByText('21.9000°N, 104.2000°E').first()).toBeVisible();
  await expect(page.getByText('Công dân ẩn danh')).toBeVisible();
  await expect(page.getByText('Nứt đất 14')).toHaveCount(0);
});

test('empty list shows the empty state', async ({ page }) => {
  await openReports(page, { reports: [] });
  await expect(page.getByText('Không có báo cáo hiện trường nào.')).toBeVisible();
});

test('a failed load shows the error and no list', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? [500, {}] : undefined));
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Không có báo cáo hiện trường nào.')).toBeVisible();
});

test('status filter and search narrow the list', async ({ page }) => {
  await openReports(page);
  await filter(page).selectOption('archived');
  await expect(page.getByText('Nứt đất 13')).toBeVisible();
  await expect(page.getByText('Nứt đất 11')).toHaveCount(0);
  await filter(page).selectOption('ALL');
  await page.getByPlaceholder('Tìm theo nội dung, tên người gửi, số điện thoại...').fill('0911222333');
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(page.getByText('Nứt đất 12')).toHaveCount(0);
});

test('photo: thumbnail is fetched through the API, click opens the lightbox, clicking the backdrop closes it; no photo shows a placeholder', async ({ page }) => {
  const { calls } = await openReports(page);
  await expect(page.getByText('Không có ảnh')).toHaveCount(2); // reports 12 and 13
  const thumb = page.getByRole('img', { name: 'Hiện trường' });
  await expect(thumb).toHaveAttribute('src', /^blob:/);
  expect(calls.some((c) => c.method === 'GET' && c.path === '/community-reports/11/image')).toBe(true);
  await thumb.click();
  await expect(page.getByRole('img', { name: 'Phóng to' })).toBeVisible();
  await page.mouse.click(3, 3); // backdrop
  await expect(page.getByRole('img', { name: 'Phóng to' })).toHaveCount(0);
});

test('mark processed sends PATCH status=processed and the card changes', async ({ page }) => {
  const { calls } = await openReports(page, { onCall: ({ method }) => (method === 'PATCH' ? {} : undefined) });
  await page.getByRole('button', { name: 'Chuyển Đã Xử Lý' }).first().click();
  await expect(page.getByText('Đã xử lý', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Chờ xử lý', { exact: true })).toHaveCount(0);
  expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/community-reports/11/status', body: { status: 'processed' } }]);
});

test('reopen and archive send the right status', async ({ page }) => {
  const { calls } = await openReports(page, { onCall: ({ method }) => (method === 'PATCH' ? {} : undefined) });
  await page.getByRole('button', { name: 'Mở Lại' }).click(); // only report 12 is processed
  await expect(page.getByText('Chờ xử lý', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Lưu Trữ' }).first().click(); // report 11
  await expect(page.getByText('Đã lưu trữ', { exact: true })).toHaveCount(2);
  expect(writes(calls).map((c) => [c.path, c.body.status])).toEqual([
    ['/community-reports/12/status', 'submitted'],
    ['/community-reports/11/status', 'archived']
  ]);
});

test('a failed status change shows the error and keeps the old status', async ({ page }) => {
  await openReports(page, { onCall: ({ method }) => (method === 'PATCH' ? [403, {}] : undefined) });
  await page.getByRole('button', { name: 'Chuyển Đã Xử Lý' }).first().click();
  await expect(page.getByRole('alert')).toContainText('Không cập nhật được trạng thái báo cáo');
  await expect(page.getByText('Chờ xử lý', { exact: true })).toHaveCount(1);
});
