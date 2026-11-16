import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API, signed out. Display of the forgot-password panel that forgotpassword.spec.js and forgotpasswordstates.spec.js do not read:
// UW-AUTH-013 (typical screen: the two tabs, the info text per method, labels and placeholders, the email resend and the eye toggle) and
// UW-AUTH-015 (the "no eligible account" answer is a clear text, not a blank panel; the SMS branch stops there, before Firebase).
// The SMS code itself (Firebase, a real phone) is not automatable and is left out.

const EMAIL = 'quen@e2e.test';
async function openForgot(page, handler) {
  const calls = await mockBackend(page, null, handler ?? (() => undefined));
  await page.goto('/login');
  await page.locator('#lg-email').fill(EMAIL);
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  return calls;
}
const tab = (page, name) => page.getByRole('tab', { name });

test('UW-AUTH-013: the first step shows the title, both tabs with the email one selected, the email info text, one field, and the send button', async ({ page }) => {
  await openForgot(page);
  await expect(page.getByText('Xác minh bằng mã 6 số gửi tới email hoặc số điện thoại của tài khoản')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Cách nhận mã xác nhận' })).toBeVisible();
  await expect(tab(page, 'Nhận mã qua email')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'Nhận mã qua SMS')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByText('Nhập email tài khoản. Chúng tôi gửi mã 6 số vào hộp thư của bạn; nhập đúng mã rồi bạn mới được đặt mật khẩu mới.')).toBeVisible();
  await expect(page.getByLabel('Email tài khoản')).toHaveValue(EMAIL); // carried over from the login form
  await expect(page.getByLabel('Email tài khoản')).toHaveAttribute('placeholder', 'ten@email.com');
  await expect(page.getByLabel('Số điện thoại đã đăng ký')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gửi mã qua email' })).toBeEnabled();
  await expect(page.getByRole('link', { name: /Quay lại đăng nhập/ }).or(page.getByRole('button', { name: /Quay lại đăng nhập/ }))).toBeVisible();
});

test('UW-AUTH-013: the SMS tab swaps the info text, adds the phone field and renames the button; going back to email takes them away again and clears an error', async ({ page }) => {
  await openForgot(page);
  await page.getByLabel('Email tài khoản').fill('');
  await page.getByRole('button', { name: 'Gửi mã qua email' }).click();
  await expect(page.getByRole('alert')).toHaveText('Vui lòng nhập email tài khoản.');
  await tab(page, 'Nhận mã qua SMS').click();
  await expect(tab(page, 'Nhận mã qua SMS')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('alert')).toHaveCount(0); // switching method clears the error
  await expect(page.getByText('Nhập email và số điện thoại bạn đã dùng khi đăng ký. Chúng tôi gửi mã OTP qua SMS; nhập đúng mã rồi bạn mới được đặt mật khẩu mới.')).toBeVisible();
  await expect(page.getByLabel('Số điện thoại đã đăng ký')).toHaveAttribute('placeholder', '0912345678');
  await expect(page.getByLabel('Số điện thoại đã đăng ký')).toHaveAttribute('type', 'tel');
  await expect(page.getByRole('button', { name: 'Gửi mã OTP' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi mã qua email' })).toHaveCount(0);
  await tab(page, 'Nhận mã qua email').click();
  await expect(page.getByLabel('Số điện thoại đã đăng ký')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gửi mã qua email' })).toBeVisible();
});

test('UW-AUTH-015: on the SMS tab a short phone number is refused in place, and an account that cannot be reset gets a clear text; no SMS is requested', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const calls = await openForgot(page, ({ path }) => (path === '/auth/password-reset/check' ? { eligible: false } : undefined));
  await tab(page, 'Nhận mã qua SMS').click();
  await page.getByLabel('Số điện thoại đã đăng ký').fill('0912');
  await page.getByRole('button', { name: 'Gửi mã OTP' }).click();
  await expect(page.getByRole('alert')).toHaveText('Vui lòng nhập số điện thoại đã đăng ký.');
  expect(calls).toEqual([]); // refused before any request
  await page.getByLabel('Số điện thoại đã đăng ký').fill('0912 345 678');
  await page.getByRole('button', { name: 'Gửi mã OTP' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email và số điện thoại này không khớp với tài khoản nào có thể đặt lại mật khẩu. Hãy nhập đúng số đã dùng khi đăng ký.');
  expect(calls).toEqual([{ method: 'POST', path: '/auth/password-reset/check', body: { email: EMAIL, phoneNumber: '0912345678' } }]); // spaces removed, nothing else asked
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi mã OTP' })).toBeEnabled(); // the form is usable again
  expect(errors).toEqual([]);
});

test('UW-AUTH-015: when the eligibility check itself fails (500) the answer is the same clear text, not a crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openForgot(page, ({ path }) => (path === '/auth/password-reset/check' ? [500, {}] : undefined));
  await tab(page, 'Nhận mã qua SMS').click();
  await page.getByLabel('Số điện thoại đã đăng ký').fill('0912345678');
  await page.getByRole('button', { name: 'Gửi mã OTP' }).click();
  await expect(page.getByRole('alert')).toContainText('không khớp với tài khoản nào có thể đặt lại mật khẩu');
  expect(errors).toEqual([]);
});

test('UW-AUTH-013: on the code step the lead text names the address and the 10-minute validity; after the 60 s countdown "Gửi lại mã qua email" asks again and restarts it', async ({ page }) => {
  await page.clock.install();
  const calls = await openForgot(page);
  await page.getByRole('button', { name: 'Gửi mã qua email' }).click();
  await expect(page.getByText(`Nếu ${EMAIL} có tài khoản, mã 6 chữ số đã được gửi tới hộp thư (xem cả thư mục Spam). Mã có hiệu lực 10 phút. Nhập mã vào các ô dưới đây.`)).toBeVisible();
  await expect(page.getByText('Có thể gửi lại mã sau 60 giây')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi lại mã qua email' })).toHaveCount(0);
  await page.clock.runFor(61_000);
  const resend = page.getByRole('button', { name: 'Gửi lại mã qua email' });
  await expect(resend).toBeVisible();
  await resend.click();
  await expect(page.getByText(/Có thể gửi lại mã sau (60|59) giây/)).toBeVisible();
  await expect(resend).toHaveCount(0);
  expect(calls.filter((c) => c.path === '/auth/password-reset/email/request')).toHaveLength(2);
});

test('UW-AUTH-013: on the new-password step the eye button shows and hides both fields; the info line names the address', async ({ page }) => {
  await openForgot(page, ({ path }) => (path.endsWith('/email/verify') ? { resetToken: 'tok-e2e' } : undefined));
  await page.getByRole('button', { name: 'Gửi mã qua email' }).click();
  await page.getByLabel('Chữ số 1').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Xác nhận mã OTP' }).click();
  await expect(page.getByText('Đã xác minh mã.')).toBeVisible();
  await expect(page.getByText(`Hãy đặt mật khẩu mới cho ${EMAIL}.`)).toBeVisible();
  await expect(page.locator('#fp-pw')).toHaveAttribute('placeholder', 'Tối thiểu 8 ký tự');
  await expect(page.locator('#fp-pw')).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.locator('#fp-pw')).toHaveAttribute('type', 'text');
  await expect(page.locator('#fp-pw2')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(page.locator('#fp-pw')).toHaveAttribute('type', 'password');
  await expect(page.locator('#fp-pw2')).toHaveAttribute('type', 'password');
});
