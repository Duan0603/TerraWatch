import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API, signed out. loginpage.spec.js covers the empty form, 401, 403, a network failure, the busy label, a good login, the chip for officer
// and the forgot-panel switch. This file covers what is left of the login form (UW-AUTH-001, 004, 007, 008): the typical screen with its labels and
// demo chips, a 500 with and without a message, an answer without a token, and a double submit.
// UW-AUTH-003 (empty list) does not apply to a form. UW-AUTH-005 (network) and UW-AUTH-006 (401) are asserted by loginpage.spec.js:
// on /login a 401 is "wrong credentials", never a redirect (the axios interceptor skips /login).

async function openLogin(page, handler) {
  const calls = await mockBackend(page, null, handler ?? (() => undefined));
  await page.goto('/login');
  return calls;
}
const submit = (page) => page.locator('button[type="submit"].lg-btn-primary');
const fillForm = async (page, email = 'a@e2e.test', pw = 'mat-khau-dai-123') => {
  await page.locator('#lg-email').fill(email);
  await page.locator('#lg-password').fill(pw);
};

test('UW-AUTH-001: the sign-in screen shows its labels, placeholders, notice and the three entry points', async ({ page }) => {
  await openLogin(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Theo dõi mưa và địa hình, cảnh báo sạt lở 24 giờ tới');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByText('Dành cho công dân, cán bộ và quản trị viên')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('placeholder', 'ten@terrawatch.vn');
  await expect(page.getByLabel('Mật khẩu')).toHaveAttribute('placeholder', 'Ít nhất 8 ký tự');
  await expect(page.getByLabel('Mật khẩu')).toHaveAttribute('type', 'password'); // never shown in clear text on this form
  await expect(submit(page)).toHaveText('Vào trung tâm chỉ huy');
  await expect(page.getByRole('link', { name: 'Xem demo mô hình trên dữ liệu lịch sử' })).toHaveAttribute('href', '/model-demo');
  await expect(page.getByRole('button', { name: 'Quên mật khẩu?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Đăng ký công dân/ })).toContainText('Nhận cảnh báo qua SMS và ứng dụng');
  await expect(page.getByRole('button', { name: /Yêu cầu tài khoản cán bộ/ })).toBeVisible();
  // the trial-stage notice is part of the screen, once in the hero (wide) or under the card (narrow); at least one is shown
  await expect(page.getByText('Điểm nguy cơ là điểm thử nghiệm, chưa phải xác suất đã hiệu chuẩn', { exact: false }).first()).toBeVisible();
});

test('UW-AUTH-001: the quick-login chips fill the matching account, clear an old error, and move focus to the submit button', async ({ page }) => {
  const calls = await openLogin(page);
  await submit(page).click(); // empty form: puts an error on screen
  await expect(page.getByRole('alert')).toBeVisible();
  const chips = page.locator('.lg-chip');
  await expect(chips).toHaveText(['Công dân', 'Cán bộ', 'Quản trị']);
  await chips.nth(2).click();
  await expect(page.locator('#lg-email')).toHaveValue(/^admin@/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(submit(page)).toBeFocused();
  await chips.nth(0).click();
  await expect(page.locator('#lg-email')).toHaveValue(/^citizen\./);
  await expect(page.locator('#lg-password')).not.toHaveValue('');
  expect(calls).toEqual([]);
});

test('UW-AUTH-004: a 500 with a server message shows that message, keeps the typed email, and the form works again', async ({ page }) => {
  const calls = await openLogin(page, ({ path }) => (path === '/auth/login' ? [500, { message: 'Dịch vụ xác thực đang bảo trì.' }] : undefined));
  await fillForm(page);
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Dịch vụ xác thực đang bảo trì.');
  await expect(page.locator('#lg-email')).toHaveValue('a@e2e.test');
  await expect(page.locator('#lg-password')).toHaveValue('mat-khau-dai-123'); // only a 401 clears the password
  await expect(submit(page)).toBeEnabled();
  await expect(page.locator('#lg-email')).toBeEditable();
  await expect(page).toHaveURL(/\/login/);
  // other parts of the page still work while the error is up
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('UW-AUTH-004: a 500 without a body falls back to the generic text, and a second try after the server recovers goes through', async ({ page }) => {
  let down = true;
  const calls = await openLogin(page, ({ path }) => {
    if (path !== '/auth/login') return undefined;
    return down ? [500, {}] : { token: 'jwt-e2e', role: 'officer', user: { fullName: 'Cán bộ E2E' } };
  });
  await fillForm(page);
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Đăng nhập không thành công. Vui lòng kiểm tra lại.');
  down = false;
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveCount(0); // the old error is cleared as soon as the new attempt starts
  await expect(page).toHaveURL(/\/$/, { timeout: 45_000 });
  expect(calls.filter((c) => c.path === '/auth/login')).toHaveLength(2);
});

// ponytail: in AuthContext.login throw when the answer has no token; until then the page treats it as a success.
test.fixme('UW-AUTH-007: an answer without a token shows an error and stores no session', async ({ page }) => {
  // BUG: expected an error text on /login and nothing in localStorage when POST /auth/login answers 200 without token;
  // actual: AuthContext stores the string "undefined" as terrawatch_token, the page shows no error and the user is left on /login.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openLogin(page, ({ path }) => (path === '/auth/login' ? { user: { fullName: 'Không token' } } : undefined));
  await fillForm(page);
  await submit(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('terrawatch_token'))).toBeNull();
  expect(errors).toEqual([]);
});

test('UW-AUTH-007: an answer that is not JSON (an HTML page from a proxy) does not crash the page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openLogin(page);
  await page.route('**/api/v1/auth/login', (route) => (route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    : route.fulfill({ status: 502, headers: { 'access-control-allow-origin': '*' }, contentType: 'text/html', body: '<html><body>Bad gateway</body></html>' })));
  await fillForm(page);
  await submit(page).click();
  await expect(page.getByRole('alert')).toHaveText('Đăng nhập không thành công. Vui lòng kiểm tra lại.'); // 502 with no message field
  await expect(submit(page)).toBeEnabled();
  expect(errors).toEqual([]);
});

test('UW-AUTH-008: a double click on the submit button sends one request; the fields are read-only while it is in flight', async ({ page }) => {
  await openLogin(page);
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/auth/login')) posts.push(r.postData()); });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/auth/login', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    await gate;
    await route.fulfill({ status: 401, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' }); // a refusal keeps the test on /login
  });
  await fillForm(page);
  await submit(page).dblclick();
  await expect(submit(page)).toBeDisabled();
  await expect(page.locator('#lg-email')).toHaveAttribute('readonly', '');
  await expect(page.locator('#lg-password')).toHaveAttribute('readonly', '');
  release();
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.');
  await expect(submit(page)).toBeEnabled();
  expect(posts).toHaveLength(1);
});

test('UW-AUTH-008: pressing Enter twice in the password field sends one request', async ({ page }) => {
  await openLogin(page);
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/auth/login')) posts.push(r.postData()); });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/auth/login', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    await gate;
    await route.fulfill({ status: 401, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' }); // a refusal keeps the test on /login
  });
  await fillForm(page);
  await page.locator('#lg-password').press('Enter');
  await expect(submit(page)).toBeDisabled();
  await page.locator('#lg-password').press('Enter'); // the default button is disabled now, so the form is not submitted again
  release();
  await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.');
  await expect(submit(page)).toBeEnabled();
  expect(posts).toHaveLength(1);
});
