import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool, holdGet } from './helpers.js';

// Mocked API (admin). "Nhật ký quản trị" (GET /admin/audit). adminaudit.spec.js covers the rows, the filter, the empty log, a server message,
// one refresh, CSV and closing. Here: network failure + retry, 401, rows with missing fields, a double click on Làm mới, the keyboard.
// UW-AUD-005 (network), 006 (401), 007 (missing fields), 008 (double click), 010 (Tab).

const dlg = (page) => page.getByRole('dialog', { name: 'Nhật ký quản trị' });
const reload = (page) => dlg(page).getByTitle('Tải lại');
const ROW = { id: 1, at: '2026-10-10T03:00:00Z', actor: 'admin@e2e.test', action: 'USER_LOCK', targetLabel: 'Cán Bộ Một', targetId: 'u-1', detail: '' };

test('UW-AUD-005: a network failure shows the client error and no table; Làm mới lists the rows once the network is back', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? [ROW] : undefined));
  await page.route('**/api/v1/admin/audit**', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(dlg(page).getByRole('alert')).toHaveText('Network Error');
  await expect(dlg(page).locator('table')).toHaveCount(0);
  await expect(dlg(page)).not.toContainText('Chưa có thao tác nào được ghi lại.'); // an error is not an empty log
  down = false;
  await reload(page).click();
  await expect(dlg(page).locator('tbody tr')).toHaveCount(1);
  await expect(dlg(page).getByRole('alert')).toHaveCount(0);
});

test('UW-AUD-006: a 401 sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(page).toHaveURL(/\/login/);
});

test('UW-AUD-007: an object instead of a list is treated as an empty log; a row with only an action still renders, no "undefined"', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? { not: 'a list' } : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(dlg(page)).toContainText('0 dòng');
  await expect(dlg(page).locator('table')).toHaveCount(0);
  await expect(dlg(page).getByRole('alert')).toHaveCount(0);
});

test('UW-AUD-007: a row with only an action renders with dashes, no "undefined" and no crash', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? [{ id: 9, action: 'USER_UNLOCK' }] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  const row = dlg(page).locator('tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Mở khóa tài khoản');
  await expect(dlg(page)).not.toContainText('undefined');
  await expect(dlg(page)).not.toContainText('null');
});

// ponytail: filter out non-object rows (or guard r.id) in AdminAuditModal before rendering.
test.fixme('UW-AUD-007: a null row in the list does not blank the whole page', async ({ page }) => {
  // BUG: expected the dialog to stay usable when /admin/audit returns [null]; actual: the render throws
  // "Cannot read properties of null (reading 'at')" and, with no error boundary, the whole dashboard goes white.
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? [null] : undefined));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const answered = page.waitForResponse((r) => r.url().includes('/admin/audit') && r.request().method() === 'GET');
  await openAdminTool(page, 'Nhật ký quản trị');
  await answered;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // let React render the answer
  expect(errors).toEqual([]);
  await expect(page.getByRole('banner')).toBeVisible();
});

test('UW-AUD-008: Làm mới is disabled while a load is in flight, and a double click sends one more request, not two', async ({ page }) => {
  await mockBackend(page, 'admin', () => undefined);
  const g = await holdGet(page, '/admin/audit', [ROW]);
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(reload(page)).toBeDisabled();
  g.release();
  await expect(dlg(page).locator('tbody tr')).toHaveCount(1);
  await expect(reload(page)).toBeEnabled();
  expect(g.seen).toHaveLength(1);
  await reload(page).dblclick();
  await expect(reload(page)).toBeEnabled();
  await expect.poll(() => g.seen.length).toBe(2);
});

test('UW-AUD-010: Tab goes through the filter, Xuất CSV, Làm mới and Đóng in that order, and Enter on Đóng closes the dialog', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? [ROW] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(dlg(page).locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Lọc theo thao tác').focus();
  await page.keyboard.press('Tab');
  await expect(dlg(page).getByTitle('Xuất các dòng đang hiển thị ra tệp CSV')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(reload(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dlg(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dlg(page)).toHaveCount(0);
});
