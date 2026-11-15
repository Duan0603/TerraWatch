import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API, signed out. Email-code flow only: the SMS path needs Firebase and a real phone.

const EMAIL = 'quen@e2e.test';
const NEW_PW = 'mat-khau-moi-123';

async function openForgot(page, handler) {
  const calls = await mockBackend(page, null, handler ?? (() => undefined));
  await page.goto('/login');
  await page.locator('#lg-email').fill(EMAIL);
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  return calls;
}
const typeCode = async (page, code) => {
  await page.getByLabel('Chữ số 1').click();
  await page.keyboard.type(code);
};
const send = (page) => page.getByRole('button', { name: 'Gửi mã qua email' });
const confirm = (page) => page.getByRole('button', { name: 'Xác nhận mã OTP' });
async function toOtpStep(page) {
  await send(page).click();
  await expect(page.getByText('Nhập mã vào các ô dưới đây.', { exact: false })).toBeVisible();
}

test('request step needs an email; a request sends the trimmed email and moves to the code step', async ({ page }) => {
  const calls = await openForgot(page);
  await page.locator('#fp-email').fill('');
  await send(page).click();
  await expect(page.getByRole('alert')).toHaveText('Vui lòng nhập email tài khoản.');
  expect(calls).toEqual([]);

  await page.locator('#fp-email').fill(`  ${EMAIL}  `);
  await toOtpStep(page);
  await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();
  await expect(page.getByText(/Có thể gửi lại mã sau \d+ giây/)).toBeVisible();
  await expect(confirm(page)).toBeDisabled(); // needs all 6 digits
  expect(calls).toEqual([{ method: 'POST', path: '/auth/password-reset/email/request', body: { email: EMAIL } }]);
});

test('a failed request shows the server message and stays on the first step', async ({ page }) => {
  await openForgot(page, ({ path }) => (path.endsWith('/email/request') ? [503, { message: 'Dịch vụ email đang tạm ngưng.' }] : undefined));
  await send(page).click();
  await expect(page.getByRole('alert')).toHaveText('Dịch vụ email đang tạm ngưng.');
  await expect(page.locator('#fp-email')).toBeVisible();
});

test('wrong code: server message shown, still on the code step, no new-password form', async ({ page }) => {
  const calls = await openForgot(page, ({ path }) => (path.endsWith('/email/verify') ? [400, { message: 'Mã xác nhận không đúng.' }] : undefined));
  await toOtpStep(page);
  await typeCode(page, '111111');
  await confirm(page).click();
  await expect(page.getByRole('alert')).toHaveText('Mã xác nhận không đúng.');
  await expect(page.locator('#fp-pw')).toHaveCount(0);
  expect(calls.at(-1)).toEqual({ method: 'POST', path: '/auth/password-reset/email/verify', body: { email: EMAIL, code: '111111' } });
});

test('expired code: server message shown on the code step; Sửa thông tin goes back to the request form', async ({ page }) => {
  await openForgot(page, ({ path }) => (path.endsWith('/email/verify') ? [400, { message: 'Mã đã hết hạn. Hãy yêu cầu mã mới.' }] : undefined));
  await toOtpStep(page);
  await typeCode(page, '222222');
  await confirm(page).click();
  await expect(page.getByRole('alert')).toHaveText('Mã đã hết hạn. Hãy yêu cầu mã mới.');
  await page.getByRole('button', { name: 'Sửa thông tin' }).click();
  await expect(send(page)).toBeVisible();
});

test('typing again clears the code error', async ({ page }) => {
  await openForgot(page, ({ path }) => (path.endsWith('/email/verify') ? [400, { message: 'Mã xác nhận không đúng.' }] : undefined));
  await toOtpStep(page);
  await typeCode(page, '333333');
  await confirm(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Chữ số 6').fill('');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('success: code, then password rules, then reset sends the token and the login form gets the email', async ({ page }) => {
  const calls = await openForgot(page, ({ path }) => {
    if (path.endsWith('/email/verify')) return { resetToken: 'tok-e2e' };
    return {};
  });
  await toOtpStep(page);
  await typeCode(page, '123456');
  await confirm(page).click();
  await expect(page.getByText('Đã xác minh mã.')).toBeVisible();

  const save = page.getByRole('button', { name: 'Đổi mật khẩu' });
  await page.locator('#fp-pw').fill('ngan');
  await page.locator('#fp-pw2').fill('ngan');
  await save.click();
  await expect(page.getByRole('alert')).toHaveText('Mật khẩu mới phải có tối thiểu 8 ký tự.');

  await page.locator('#fp-pw').fill(NEW_PW);
  await page.locator('#fp-pw2').fill('khac-hoan-toan-1');
  await expect(page.getByRole('status')).toHaveText('Hai mật khẩu chưa khớp.');
  await save.click();
  await expect(page.getByRole('alert')).toHaveText('Hai mật khẩu chưa khớp.');
  expect(calls.some((c) => c.path.endsWith('/email/complete'))).toBe(false);

  await page.locator('#fp-pw2').fill(NEW_PW);
  await expect(page.getByRole('status')).toHaveText('Mật khẩu khớp.');
  await save.click();
  await expect(page.getByRole('heading', { name: 'Đã đặt lại mật khẩu' })).toBeVisible();
  expect(calls.at(-1)).toEqual({ method: 'POST', path: '/auth/password-reset/email/complete', body: { email: EMAIL, resetToken: 'tok-e2e', newPassword: NEW_PW } });

  await page.getByRole('button', { name: 'Đăng nhập ngay' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.locator('#lg-email')).toHaveValue(EMAIL);
  await expect(page.locator('#lg-password')).toHaveValue('');
});

test('a reset token that expires on the last step sends the user back to request a new code', async ({ page }) => {
  await openForgot(page, ({ path }) => {
    if (path.endsWith('/email/verify')) return { resetToken: 'tok-old' };
    if (path.endsWith('/email/complete')) return [400, { message: 'Mã đặt lại đã hết hạn.' }];
  });
  await toOtpStep(page);
  await typeCode(page, '123456');
  await confirm(page).click();
  await page.locator('#fp-pw').fill(NEW_PW);
  await page.locator('#fp-pw2').fill(NEW_PW);
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
  await expect(page.getByRole('alert')).toHaveText('Mã đặt lại đã hết hạn.');
  await expect(send(page)).toBeVisible();
});
