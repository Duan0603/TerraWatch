import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API, signed out. The forgot-password panel (email-code flow; the SMS flow needs Firebase and a real phone).
// forgotpassword.spec.js covers the empty email, a server message, wrong/expired codes and the full success. Here: network failure,
// a 500 without a message, a 401 (a signed-out page must not redirect), an answer without a reset token, the in-flight label and double click.
// UW-AUTH-016 (500), 017 (network), 018 (401), 019 (malformed), 020 (double click).

const EMAIL = 'quen@e2e.test';
const send = (page) => page.getByRole('button', { name: 'Gửi mã qua email' });
async function openForgot(page, handler) {
  const calls = await mockBackend(page, null, handler ?? (() => undefined));
  await page.goto('/login');
  await page.locator('#lg-email').fill(EMAIL);
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  return calls;
}

test('UW-AUTH-016: a 500 without a message shows a readable text, stays on the first step, and the form is usable again', async ({ page }) => {
  const calls = await openForgot(page, ({ path }) => (path.endsWith('/email/request') ? [500, {}] : undefined));
  await send(page).click();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText(/undefined|\[object/);
  await expect(page.locator('#fp-email')).toHaveValue(EMAIL);
  await expect(send(page)).toBeEnabled();
  expect(calls).toHaveLength(1);
});

test('UW-AUTH-017: a network failure shows the cannot-reach text on the first step; sending again after the network is back moves to the code step', async ({ page }) => {
  let down = true;
  await openForgot(page);
  await page.route('**/api/v1/auth/password-reset/email/request', (route) => (down ? route.abort('connectionrefused') : route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' })));
  await send(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#fp-email')).toBeVisible();
  down = false;
  await send(page).click();
  await expect(page.getByText('Nhập mã vào các ô dưới đây.', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('UW-AUTH-018: a 401 from the request endpoint is an error on the panel, not a redirect: the user stays on /login', async ({ page }) => {
  await openForgot(page, ({ path }) => (path.endsWith('/email/request') ? [401, { message: 'x' }] : undefined));
  await send(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
});

// ponytail: in authApi.verifyEmailCode throw when data.resetToken is missing, so the panel shows an error instead of going on.
test.fixme('UW-AUTH-019: a verify answer without a reset token keeps the user on the code step with an error', async ({ page }) => {
  // BUG: expected an error on the code step when /auth/password-reset/email/verify answers 200 without resetToken;
  // actual: the panel opens the new-password form with an undefined token, and only the last step is refused by the server.
  await openForgot(page, ({ path }) => (path.endsWith('/email/verify') ? {} : undefined));
  await send(page).click();
  await expect(page.getByText('Nhập mã vào các ô dưới đây.', { exact: false })).toBeVisible();
  await page.getByLabel('Chữ số 1').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Xác nhận mã OTP' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('#fp-pw')).toHaveCount(0);
});

test('UW-AUTH-020: the button shows "Đang gửi…" and is disabled while the request is in flight, so a double click sends one request', async ({ page }) => {
  const calls = await openForgot(page);
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/auth/password-reset/email/request', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    await gate;
    await route.fallback();
  });
  await send(page).dblclick();
  await expect(page.getByRole('button', { name: 'Đang gửi…' })).toBeDisabled();
  release();
  await expect(page.getByText('Nhập mã vào các ô dưới đây.', { exact: false })).toBeVisible();
  expect(calls.filter((c) => c.path === '/auth/password-reset/email/request')).toHaveLength(1);
});
