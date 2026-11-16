import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool, holdGet } from './helpers.js';

// Mocked API (admin). "Quản trị người dùng" (GET /admin/users). usermanagement.spec.js covers the list, a server message, filters, approve,
// reject, lock/unlock, role and self-protection. Here: the loading text, network failure + retry, 401, malformed rows, a double click on
// Xác nhận and on Làm mới, and the keyboard. UW-USR-004 is already covered there (server message); the 500-without-message text is new.
// UW-USR-004 (500 fallback), 005 (network), 006 (401), 007 (malformed), 008 (double click), 010 (Tab).

const u = (id, fullName, extra = {}) => ({ userId: id, fullName, email: `${id}@e2e.test`, role: 'citizen', isActive: true, approvalStatus: 'approved', phoneNumber: null, ...extra });
const ROWS = [u('u-1', 'Dân Một'), u('u-2', 'Dân Hai')];
const refresh = (page) => page.getByRole('button', { name: 'Làm mới' }).last(); // the first one belongs to the dashboard sidebar
const open = async (page) => {
  await page.goto('/');
  await openAdminTool(page, 'Quản trị người dùng');
  await expect(page.getByRole('heading', { name: /Quản Trị Người Dùng/ })).toBeVisible();
};

test('UW-USR-004: a 500 without a message shows the HTTP client text in the body, not an empty list or the filter-empty text', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? [500, {}] : undefined));
  await open(page);
  await expect(page.getByText('Request failed with status code 500')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByText('Không tìm thấy người dùng phù hợp với tiêu chí lọc')).toHaveCount(0);
  await expect(page.getByText('Tổng tài khoản:').locator('xpath=following-sibling::span')).toHaveText('0');
});

test('UW-USR-005: a network failure shows the client error; Làm mới lists the accounts once the network is back and the error goes away', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? ROWS : undefined));
  await page.route('**/api/v1/admin/users**', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await open(page);
  await expect(page.getByText('Network Error')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  down = false;
  await refresh(page).click();
  await expect(page.getByRole('row')).toHaveCount(3); // header + 2 accounts
  await expect(page.getByText('Network Error')).toHaveCount(0);
});

test('UW-USR-006: a 401 sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Quản trị người dùng');
  await expect(page).toHaveURL(/\/login/);
});

test('UW-USR-007: an object instead of a list is an empty list; accounts with only an id render with no "undefined"', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? { not: 'a list' } : undefined));
  await open(page);
  await expect(page.getByText('Không tìm thấy người dùng phù hợp với tiêu chí lọc')).toBeVisible();
  await expect(page.getByText('Tổng tài khoản:').locator('xpath=following-sibling::span')).toHaveText('0');
});

test('UW-USR-007: an account with only an id still gets a row, and nothing reads "undefined" or "null"', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? [{ userId: 'u-x' }] : undefined));
  await open(page);
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('table')).not.toContainText('undefined');
  await expect(page.getByRole('table')).not.toContainText('null');
});

// ponytail: filter out non-object rows in UserManagementModal before counting and rendering.
test.fixme('UW-USR-007: a null row in the list does not blank the whole page', async ({ page }) => {
  // BUG: expected the dialog to stay usable when /admin/users returns [null]; actual: the render throws
  // "Cannot read properties of null (reading 'approvalStatus')" and, with no error boundary, the whole dashboard goes white.
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? [null] : undefined));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const answered = page.waitForResponse((r) => r.url().includes('/admin/users') && r.request().method() === 'GET');
  await openAdminTool(page, 'Quản trị người dùng');
  await answered;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // let React render the answer
  expect(errors).toEqual([]);
  await expect(page.getByRole('banner')).toBeVisible();
});

test('UW-USR-004/008: while loading the dialog says so and Làm mới is disabled; after it, a double click sends one more request', async ({ page }) => {
  await mockBackend(page, 'admin', () => undefined);
  const g = await holdGet(page, '/admin/users', ROWS);
  await open(page);
  await expect(page.getByText('Đang tải danh sách người dùng...')).toBeVisible();
  await expect(refresh(page)).toBeDisabled();
  g.release();
  await expect(page.getByRole('row')).toHaveCount(3);
  await expect(refresh(page)).toBeEnabled();
  expect(g.seen).toHaveLength(1);
  await refresh(page).dblclick();
  await expect(refresh(page)).toBeEnabled();
  await expect.poll(() => g.seen.length).toBe(2);
});

test('UW-USR-008: a double click on Xác nhận sends one status change, not two', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ method, path }) => {
    if (path === '/admin/users' && method === 'GET') return ROWS;
    if (path === '/admin/users/u-1/status') return {};
  });
  await open(page);
  await page.getByRole('row', { name: /Dân Một/ }).getByRole('button', { name: 'Khóa' }).click();
  await page.getByRole('alertdialog', { name: 'Xác nhận thao tác' }).getByRole('button', { name: 'Xác nhận' }).dblclick();
  await expect(page.getByText('Đã khóa tài khoản thành công')).toBeVisible();
  expect(calls.filter((c) => c.method === 'PATCH')).toEqual([{ method: 'PATCH', path: '/admin/users/u-1/status', body: { isActive: false } }]);
});

test('UW-USR-010: the confirmation puts focus on Xác nhận, Shift+Tab reaches Hủy, and Enter on Hủy dismisses it without a request', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ method, path }) => (path === '/admin/users' && method === 'GET' ? ROWS : undefined));
  await open(page);
  await page.getByRole('row', { name: /Dân Một/ }).getByRole('button', { name: 'Khóa' }).click();
  const ask = page.getByRole('alertdialog', { name: 'Xác nhận thao tác' });
  await expect(ask.getByRole('button', { name: 'Xác nhận' })).toBeFocused(); // autoFocus: Enter would confirm, so the safe key is Shift+Tab
  await page.keyboard.press('Shift+Tab');
  await expect(ask.getByRole('button', { name: 'Hủy' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ask).toHaveCount(0);
  expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
});
