import { test, expect } from '@playwright/test';
import { mockBackend, openTool, holdGet } from './helpers.js';

// Mocked API (officer). "Báo cáo hiện trường" (GET /community-reports, PATCH /community-reports/{id}/status). fieldreports.spec.js covers the
// list, empty, a 500, filters, photo, status changes and one failed change. Here: the loading text, network failure + retry, 401, malformed
// answers, the double click on a status button, and the keyboard.
// UW-RPT-003 (empty) and UW-RPT-004 (500) are already covered there. UW-RPT-005, 006, 007, 008, 010 are new.

const report = (id, status) => ({
  report_id: id, status, longitude: 104.2, latitude: 21.9, description: `Nứt đất ${id}`,
  observed_at: '2026-10-10T03:00:00Z', image_url: null, submitter_name: `Người báo ${id}`, submitter_phone: null
});
const ROWS = [report(21, 'submitted'), report(22, 'processed')];
const refresh = (page) => page.getByRole('button', { name: 'Làm Mới', exact: true });
const heading = (page) => page.getByRole('heading', { name: 'BÁO CÁO HIỆN TRƯỜNG TỪ CỘNG ĐỒNG' });

test('UW-RPT-005: a network failure shows the client error and the empty text; Làm Mới lists the reports once the network is back', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? ROWS : undefined));
  await page.route('**/api/v1/community-reports', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByRole('alert')).toHaveText('Network Error');
  await expect(page.getByText('Không có báo cáo hiện trường nào.')).toBeVisible();
  down = false;
  await refresh(page).click();
  await expect(page.getByText('Nứt đất 21')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('UW-RPT-006: a 401 on /community-reports (the dashboard loads it for the KPI strip) sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('UW-RPT-007: a report with only an id and coordinates still renders, with no "undefined" or "null" in the card', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? [{ report_id: 31, longitude: 104.2, latitude: 21.9 }] : undefined));
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByText('#31', { exact: true })).toBeVisible();
  await expect(page.getByText('Chờ xử lý', { exact: true })).toBeVisible(); // no status: treated as newly submitted
  await expect(page.getByText('Công dân ẩn danh')).toBeVisible();
  await expect(page.getByText('Không có ảnh')).toBeVisible();
  const card = page.locator('div', { has: page.getByText('#31', { exact: true }) }).last();
  await expect(card).not.toContainText('undefined'); // (the KPI strip behind the dialog has its own text, so only the card is checked)
  await expect(card).not.toContainText('null');
  await expect(card).not.toContainText('NaN');
});

// ponytail: in api/forecastApi.js getFieldReports, use `Array.isArray(rows) ? rows : []` (the modal already guards the result the same way).
test.fixme('UW-RPT-007: an object instead of a list is an empty list, not a raw JavaScript error', async ({ page }) => {
  // BUG: expected "Không có báo cáo hiện trường nào." with no alert (the modal guards with Array.isArray); actual: the alert reads
  // "rows.filter is not a function" because forecastApi.getFieldReports filters before that guard.
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? { not: 'a list' } : undefined));
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByText('Không có báo cáo hiện trường nào.')).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText('is not a function');
});

test('UW-RPT-003/008: while loading the dialog says so and Làm Mới is disabled; after it, a double click sends one more request', async ({ page }) => {
  await mockBackend(page, 'officer', () => undefined);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Công cụ' })).toBeVisible();
  const g = await holdGet(page, '/community-reports', ROWS); // after the dashboard's own load, so only the dialog's requests are held and counted
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByText('Đang tải danh sách báo cáo...')).toBeVisible();
  await expect(page.getByText('Không có báo cáo hiện trường nào.')).toHaveCount(0); // loading is not "empty"
  await expect(refresh(page)).toBeDisabled();
  g.release();
  await expect(page.getByText('Nứt đất 21')).toBeVisible();
  await expect(refresh(page)).toBeEnabled();
  expect(g.seen).toHaveLength(1);
  await refresh(page).dblclick();
  await expect(refresh(page)).toBeEnabled();
  await expect.poll(() => g.seen.length).toBe(2);
});

test('UW-RPT-008: while a status change is in flight its button is disabled, so a double click sends one PATCH', async ({ page }) => {
  const calls = await mockBackend(page, 'officer', ({ method, path }) => {
    if (path === '/community-reports' && method === 'GET') return ROWS;
    if (method === 'PATCH') return {};
  });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/community-reports/21/status', async (route) => {
    if (route.request().method() === 'PATCH') await gate;
    await route.fallback();
  });
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await page.getByRole('button', { name: 'Chuyển Đã Xử Lý' }).click();
  const busy = page.getByRole('button', { name: 'Đang cập nhật...' });
  await expect(busy).toBeDisabled(); // the label says what is happening and the button cannot be pressed again
  await busy.click({ force: true }); // a second click on the disabled button must do nothing
  release();
  await expect(page.getByText('Đã xử lý', { exact: true })).toHaveCount(2);
  expect(calls.filter((c) => c.method === 'PATCH')).toEqual([{ method: 'PATCH', path: '/community-reports/21/status', body: { status: 'processed' } }]);
});

test('UW-RPT-010: Tab goes from the status filter to Làm Mới and on into the first card\'s actions', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? ROWS : undefined));
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByText('Nứt đất 21')).toBeVisible();
  await page.getByRole('combobox').focus();
  await page.keyboard.press('Tab');
  await expect(refresh(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Xem Trên Bản Đồ|Chuyển Đã Xử Lý/ }).first()).toBeFocused(); // first card of the list
});
