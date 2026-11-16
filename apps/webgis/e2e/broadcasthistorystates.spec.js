import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Mocked API (admin). "Lịch sử lệnh" (GET /notifications/broadcasts, POST /notifications/broadcast/{id}/revoke).
// broadcasthistory.spec.js covers the rows, search, CSV, empty, 403 + retry, a 500, revoke and a failed revoke.
// Here: network failure, 401, malformed rows, a double click on the revoke confirmation, the keyboard.
// UW-BRD-003 and UW-BRD-004 are already covered there. UW-BRD-005, 006, 007, 008, 010 are new.

const ID = 'aaaaaaaa-1111-4111-8111-000000000001';
const ROW = { broadcastId: ID, sentAt: '2026-10-10T03:00:00Z', areaId: 1, areaName: 'Khu Mù Cang Chải', runId: 'run-a', recipients: 5, sent: 5, failed: 0, status: 'active', message: 'Sơ tán khẩn cấp', senderName: 'Quản trị An', severity: 'extreme' };
const heading = (page) => page.getByRole('heading', { name: 'NHẬT KÝ ĐIỀU PHỐI & PHÁT CẢNH BÁO KHẨN CẤP' });
const reload = (page) => page.getByTitle('Làm mới danh sách');

test('UW-BRD-005: a network failure shows the fallback text with "Network Error" and no rows; Làm Mới lists the broadcast once the network is back', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'admin', ({ path }) => (path === '/notifications/broadcasts' ? [ROW] : undefined));
  await page.route('**/api/v1/notifications/broadcasts', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await expect(page.getByRole('alert')).toHaveText('Không tải được lịch sử phát lệnh (Network Error).');
  await expect(page.locator('code')).toHaveCount(0);
  down = false;
  await reload(page).click();
  await expect(page.locator('code', { hasText: 'BC-aaaaaaaa' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('UW-BRD-006: a 401 on /notifications/broadcasts (the dashboard loads it for the KPI strip) sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/notifications/broadcasts' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('UW-BRD-007: a broadcast with no area name and no sender shows the fallbacks ("Khu vực #id", "Không rõ"), not "undefined"', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/notifications/broadcasts' ? [{ broadcastId: ID, areaId: 9, recipients: 0, sent: 0, failed: 0, status: 'active' }] : undefined));
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await expect(heading(page)).toBeVisible();
  await expect(page.getByText('Khu vực #9').first()).toBeVisible();
  await expect(page.getByText('Không rõ').first()).toBeVisible();
  const card = page.locator('div', { has: page.locator('code', { hasText: 'BC-aaaaaaaa' }) }).last();
  await expect(card).not.toContainText('undefined');
  await expect(card).not.toContainText('Invalid');
});

// ponytail: in api/broadcastHistory.js skip rows without a string broadcastId (or default it) instead of throwing for the whole list.
test.fixme('UW-BRD-007: one row without broadcastId does not hide the other broadcasts behind a raw JavaScript error', async ({ page }) => {
  // BUG: expected the valid broadcast to be listed (the bad row skipped); actual: toHistoryEntry throws
  // "Cannot read properties of undefined (reading 'slice')", which is shown as the load error and the whole list is empty.
  await mockBackend(page, 'admin', ({ path }) => (path === '/notifications/broadcasts' ? [{ areaId: 1 }, ROW] : undefined));
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await expect(page.locator('code', { hasText: 'BC-aaaaaaaa' })).toBeVisible();
});

test('UW-BRD-008: the confirm button says "Đang thu hồi..." and is disabled while the request is in flight, so a double click sends one POST', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ method, path }) => {
    if (path === '/notifications/broadcasts') return [ROW];
    if (/\/revoke$/.test(path) && method === 'POST') return {};
  });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/notifications/broadcast/*/revoke', async (route) => {
    if (route.request().method() === 'POST') await gate;
    await route.fallback();
  });
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await page.getByRole('button', { name: 'Thu Hồi Lệnh' }).click();
  await page.getByRole('button', { name: 'Đồng Ý Thu Hồi' }).dblclick();
  await expect(page.getByRole('button', { name: 'Đang thu hồi...' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled(); // the confirmation cannot be backed out of mid-request
  release();
  await expect(page.getByText('ĐÃ THU HỒI', { exact: true })).toBeVisible();
  expect(calls.filter((c) => c.method === 'POST')).toEqual([{ method: 'POST', path: `/notifications/broadcast/${ID}/revoke`, body: null }]);
});

test('UW-BRD-010: Tab goes from the search box through Xuất CSV to Làm Mới; Enter on Hủy of the revoke confirmation backs out without a request', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ path }) => (path === '/notifications/broadcasts' ? [ROW] : undefined));
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await expect(page.locator('code', { hasText: 'BC-aaaaaaaa' })).toBeVisible();
  await page.getByPlaceholder(/Tìm kiếm theo khu vực, mã lệnh/).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Xuất CSV' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reload(page)).toBeFocused();

  await page.getByRole('button', { name: 'Thu Hồi Lệnh' }).click();
  await page.getByRole('button', { name: 'Hủy', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Xác nhận thu hồi?')).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});
