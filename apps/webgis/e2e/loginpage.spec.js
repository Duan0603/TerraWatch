import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API, signed out. auth.spec.js covers sign-in per role against the real gateway; this file covers validation and error states.

async function openLogin(page, handler) {
  const calls = await mockBackend(page, null, handler ?? (() => undefined));
  await page.goto('/login');
  return calls;
}
const submit = (page) => page.locator('button[type="submit"].lg-btn-primary');

test('empty form is refused in the browser, no request is sent', async ({ page }) => {
  const calls = await openLogin(page);
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Vui lòng nhập đầy đủ Email và Mật khẩu.');
  await page.locator('#lg-email').fill('a@e2e.test');
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Vui lòng nhập đầy đủ Email và Mật khẩu.');
  expect(calls).toEqual([]);
});

test('401 shows the wrong-credentials message, clears the password and refocuses it', async ({ page }) => {
  const calls = await openLogin(page, ({ path }) => (path === '/auth/login' ? [401, { message: 'bad' }] : undefined));
  await page.locator('#lg-email').fill('a@e2e.test');
  await page.locator('#lg-password').fill('sai-mat-khau');
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.');
  await expect(page.locator('#lg-password')).toHaveValue('');
  await expect(page.locator('#lg-password')).toBeFocused();
  await expect(page.locator('#lg-email')).toHaveValue('a@e2e.test');
  expect(calls).toEqual([{ method: 'POST', path: '/auth/login', body: { email: 'a@e2e.test', password: 'sai-mat-khau' } }]);
  await expect(page).toHaveURL(/\/login/);
});

test('403 shows the server message (locked or pending account)', async ({ page }) => {
  await openLogin(page, ({ path }) => (path === '/auth/login' ? [403, { message: 'Tài khoản đang chờ quản trị viên phê duyệt.' }] : undefined));
  await page.locator('#lg-email').fill('cho@e2e.test');
  await page.locator('#lg-password').fill('mat-khau-dai-123');
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Tài khoản đang chờ quản trị viên phê duyệt.');
  await expect(page).toHaveURL(/\/login/);
});

test('403 without a message falls back to the generic text', async ({ page }) => {
  await openLogin(page, ({ path }) => (path === '/auth/login' ? [403, {}] : undefined));
  await page.locator('#lg-email').fill('cho@e2e.test');
  await page.locator('#lg-password').fill('mat-khau-dai-123');
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Đăng nhập không thành công. Vui lòng kiểm tra lại.');
});

test('network failure shows the cannot-reach-server message', async ({ page }) => {
  await openLogin(page);
  await page.route('**/api/v1/auth/login', (route) => route.abort('connectionrefused')); // registered last, wins
  await page.locator('#lg-email').fill('a@e2e.test');
  await page.locator('#lg-password').fill('mat-khau-dai-123');
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Không kết nối được máy chủ. Thử lại sau.');
});

test('the button shows a busy label and is disabled while the request is in flight', async ({ page }) => {
  await openLogin(page);
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/auth/login', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    await gate;
    await route.fulfill({ status: 401, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' });
  });
  await page.locator('#lg-email').fill('a@e2e.test');
  await page.locator('#lg-password').fill('mat-khau-dai-123');
  await submit(page).click();
  await expect(submit(page)).toBeDisabled();
  await expect(submit(page)).toHaveText('Đang đăng nhập…');
  release();
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.');
  await expect(submit(page)).toBeEnabled();
});

test('a successful login stores the session and leaves /login', async ({ page }) => {
  const calls = await openLogin(page, ({ path }) => (path === '/auth/login'
    ? { token: 'jwt-e2e', role: 'officer', user: { fullName: 'Cán bộ E2E' } } : undefined));
  await page.locator('#lg-email').fill('officer@e2e.test');
  await page.locator('#lg-password').fill('mat-khau-dai-123');
  await submit(page).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 45_000 });
  await expect(page.locator('.nav-user-role')).toHaveText('Cán bộ giám sát');
  expect(calls[0]).toEqual({ method: 'POST', path: '/auth/login', body: { email: 'officer@e2e.test', password: 'mat-khau-dai-123' } });
  expect(await page.evaluate(() => localStorage.getItem('terrawatch_token'))).toBe('jwt-e2e');
});

test('a signed-out visit to / is sent to /login', async ({ page }) => {
  await openLogin(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('the quick-login chip fills the form but does not submit', async ({ page }) => {
  const calls = await openLogin(page);
  await page.locator('.lg-chip', { hasText: 'Cán bộ' }).click();
  await expect(page.locator('#lg-email')).toHaveValue(/^officer\./);
  await expect(page.locator('#lg-password')).not.toHaveValue('');
  expect(calls).toEqual([]);
});

test('"Quên mật khẩu?" slides to the forgot panel and Escape returns to the login form', async ({ page }) => {
  await openLogin(page);
  await page.locator('#lg-email').fill('quen@e2e.test');
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await expect(page.locator('#fp-email')).toHaveValue('quen@e2e.test'); // carried over from the login field
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});
