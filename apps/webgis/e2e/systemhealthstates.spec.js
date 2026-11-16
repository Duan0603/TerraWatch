import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool } from './helpers.js';

// Mocked API (admin). "Tình trạng hệ thống" (GET /admin/system-health). systemhealth.spec.js covers the happy rows, the colours,
// one refresh and a server message. Here: network failure + retry, 401, a malformed answer, the in-flight state and the keyboard.
// UW-DASH-110 (network), 111 (401), 112 (malformed), 113 (double click), 115 (Tab).

const HEALTH = { checkedAt: '2026-10-10T03:00:00Z', components: [{ key: 'db', label: 'Cơ sở dữ liệu', status: 'ok', latencyMs: 12, detail: 'ok' }], freshness: [] };
const dlg = (page) => page.getByRole('dialog', { name: 'Tình trạng hệ thống' });
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

test('UW-DASH-110: a network failure shows the client error; Kiểm tra lại shows the services once the network is back, and the error goes away', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/system-health' ? HEALTH : undefined));
  await page.route('**/api/v1/admin/system-health', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await page.goto('/');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg(page).getByRole('alert')).toHaveText('Network Error');
  await expect(dlg(page).getByRole('region', { name: 'Các thành phần' })).toHaveCount(0);
  down = false;
  await dlg(page).getByTitle('Kiểm tra lại').click();
  await expect(dlg(page).getByRole('region', { name: 'Các thành phần' })).toContainText('Cơ sở dữ liệu');
  await expect(dlg(page).getByRole('alert')).toHaveCount(0);
});

test('UW-DASH-111: a 401 sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/system-health' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(page).toHaveURL(/\/login/);
});

// ponytail: guard `data.components ?? []` and `data.freshness ?? []` in SystemHealthModal.
test.fixme('UW-DASH-112: an answer without the component list does not blank the whole page', async ({ page }) => {
  // BUG: expected the dialog to stay (or show an error) when /admin/system-health returns {}; actual: the render throws
  // "Cannot read properties of undefined (reading 'map')" and with no error boundary the whole dashboard goes white.
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/system-health' ? {} : undefined));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const answered = page.waitForResponse((r) => r.url().includes('/admin/system-health') && r.request().method() === 'GET');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await answered;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // let React render the answer
  expect(errors).toEqual([]);
  await expect(page.getByRole('banner')).toBeVisible();
});

test('UW-DASH-113: while the answer is awaited the title says "Đang kiểm tra…" and Làm mới is disabled; a double click sends one request', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let hold = true;
  await mockBackend(page, 'admin', () => undefined);
  const seen = [];
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().endsWith('/api/v1/admin/system-health')) seen.push(r.url()); });
  await page.route('**/api/v1/admin/system-health', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (hold) await gate;
    await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(HEALTH) });
  });
  await page.goto('/');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg(page)).toContainText('Đang kiểm tra…');
  await expect(dlg(page).getByTitle('Kiểm tra lại')).toBeDisabled();
  hold = false;
  release();
  await expect(dlg(page)).toContainText('Kiểm tra lúc');
  await expect(dlg(page).getByTitle('Kiểm tra lại')).toBeEnabled();
  expect(seen).toHaveLength(1);

  await dlg(page).getByTitle('Kiểm tra lại').dblclick();
  await expect.poll(() => seen.length).toBe(2); // the second click lands on a disabled button: one more request, not two
  await expect(dlg(page).getByTitle('Kiểm tra lại')).toBeEnabled();
  expect(seen).toHaveLength(2);
});

test('UW-DASH-115: Tab goes from Làm mới to Đóng, and Enter on Đóng closes the dialog', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/system-health' ? HEALTH : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg(page)).toContainText('Kiểm tra lúc');
  await dlg(page).getByTitle('Kiểm tra lại').focus();
  await page.keyboard.press('Tab');
  await expect(dlg(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dlg(page)).toHaveCount(0);
});
