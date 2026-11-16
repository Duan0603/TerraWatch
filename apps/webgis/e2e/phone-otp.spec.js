import { test, expect } from '@playwright/test';

// Story 4.44: sign-up texts the code through our own server (no Firebase, no reCAPTCHA) and registers with its phoneToken.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };

async function backend(page, answers) {
  const calls = [];
  await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => route.abort());
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname.replace('/api/v1', '');
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ method: req.method(), path, body });
    const [status, out] = answers(path, body) ?? [200, {}];
    await route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(out) });
  });
  return calls;
}

async function fillSignUp(page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /Đăng ký công dân/ }).click();
  await page.locator('#rg-name').fill('Nguyễn Văn A');
  await page.locator('#rg-email').fill('a@example.com');
  await page.locator('#rg-phone').fill('0912 345 678');
  await page.locator('#rg-pw').fill('secret123');
  await page.locator('#rg-pw2').fill('secret123');
  await page.getByRole('button', { name: /Tiếp tục: nhận mã OTP/ }).click();
}

test('sign-up: the server texts the code, the right code registers the number with its token', async ({ page }) => {
  const calls = await backend(page, (path, body) => {
    if (path === '/auth/email-exists') return [200, { exists: false }];
    if (path === '/auth/phone-otp/request') return [200, { sent: true }];
    if (path === '/auth/phone-otp/verify') return body.code === '246810' ? [200, { phoneToken: 'tok-1' }] : [400, { message: 'Mã xác thực không đúng hoặc đã hết hạn' }];
    if (path === '/auth/register') return [201, { token: 't', user: { userId: 'u1' } }];
  });
  await fillSignUp(page);
  const otp = page.getByRole('group', { name: 'Mã OTP gồm 6 chữ số' });
  await expect(otp).toBeVisible();
  expect(calls.find((c) => c.path === '/auth/phone-otp/request').body).toEqual({ phoneNumber: '+84912345678' });

  await page.getByLabel('Chữ số 1').fill('111111'); // pasting the whole code fills all six boxes
  await page.getByRole('button', { name: /Xác nhận và hoàn tất/ }).click();
  await expect(page.getByText('Mã xác thực không đúng hoặc đã hết hạn')).toBeVisible();

  await page.getByLabel('Chữ số 1').fill('246810');
  await page.getByRole('button', { name: /Xác nhận và hoàn tất/ }).click();
  await expect(page.getByText(/Đăng Ký & Xác Thực Số Điện Thoại Thành Công/)).toBeVisible();
  expect(calls.find((c) => c.path === '/auth/register').body).toMatchObject({ phoneNumber: '0912345678', phoneToken: 'tok-1' });
});

test('sign-up: the server refusing to send (wait / SMS off) shows its reason and stays on the form', async ({ page }) => {
  await backend(page, (path) => {
    if (path === '/auth/email-exists') return [200, { exists: false }];
    if (path === '/auth/phone-otp/request') return [429, { message: 'Vui lòng đợi 60 giây rồi mới gửi lại mã.' }];
  });
  await fillSignUp(page);
  await expect(page.getByText(/Không thể gửi mã OTP SMS: Vui lòng đợi 60 giây/)).toBeVisible();
  await expect(page.locator('#rg-phone')).toBeVisible();
});
