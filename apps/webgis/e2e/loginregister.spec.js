import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Mocked API, signed out: citizen and officer registration on /login (form step, OTP step, done step).
// loginpage.spec.js and forgotpassword.spec.js cover sign-in and the password reset; this file covers sign-up.
//
// Firebase SMS cannot run here (no project key, no real phone). Only that boundary is replaced: authApi.sendSmsOtp and
// authApi.verifySmsOtp are swapped in the page for fakes. Everything else is the real app code (validation, steps, the
// email-exists check, the request bodies sent to the mocked API, the server error mapping).
// Not covered: the real Firebase calls and their errors (quota, billing, invalid code), which need a Firebase project and a real phone.
// Also not covered: the "Firebase not configured" message, because it depends on the developer's local .env.

async function openRegister(page, kind, { handler, sms = {}, stub = true } = {}) {
  const calls = await mockBackend(page, null, (c) => handler?.(c) ?? undefined);
  await page.goto('/login');
  const sent = [];
  const verified = [];
  if (stub) {
    await page.exposeFunction('__otpSend', (phone) => { sent.push(phone); return sms.sendError ?? null; });
    await page.exposeFunction('__otpVerify', (phone, code) => { verified.push([phone, code]); return sms.verifyError ?? null; });
    await page.evaluate(async () => {
      const { authApi } = await import('/src/api/authApi.js');
      authApi.sendSmsOtp = async (phone) => {
        const err = await window.__otpSend(phone);
        if (err) throw new Error(err);
        return { success: true, formattedPhone: `+84${phone.replace(/^0/, '')}` };
      };
      authApi.verifySmsOtp = async (phone, code) => {
        const err = await window.__otpVerify(phone, code);
        if (err) throw new Error(err);
        return { success: true, idToken: 'phone-token-e2e' };
      };
    });
  }
  await page.getByRole('button', { name: kind === 'officer' ? /Yêu cầu tài khoản cán bộ/ : /Đăng ký công dân/ }).click();
  await expect(page.getByRole('heading', { name: kind === 'officer' ? 'Yêu cầu tài khoản cán bộ' : 'Đăng ký tài khoản công dân' })).toBeVisible();
  // The panel moves focus to the first field 420 ms after it opens; wait for that so it cannot land later and steal focus from what a test does next.
  await expect(page.locator('#rg-name')).toBeFocused();
  return { calls, sent, verified };
}

const next = (page) => page.getByRole('button', { name: /Tiếp tục: nhận mã OTP/ });
const alert = (page) => page.locator('.lg-slide:not([inert])').getByRole('alert');
const fill = async (page, v = {}) => {
  const d = { name: 'Hoàng Văn Dũng', email: 'dung@e2e.test', phone: '0912 345 678', pw: 'mat-khau-dai-123', pw2: 'mat-khau-dai-123', ...v };
  await page.locator('#rg-name').fill(d.name);
  await page.locator('#rg-email').fill(d.email);
  await page.locator('#rg-phone').fill(d.phone);
  if (d.unit !== undefined) await page.locator('#rg-unit').fill(d.unit);
  await page.locator('#rg-pw').fill(d.pw);
  await page.locator('#rg-pw2').fill(d.pw2);
};
const stepNow = (page) => page.locator('.lg-steps .lg-step[aria-current="step"] .lg-step-label');
const toOtp = async (page) => {
  await next(page).click();
  await expect(page.getByText('Chúng tôi đã gửi tin nhắn SMS chứa mã 6 chữ số tới')).toBeVisible();
};
const typeCode = async (page, code) => {
  await page.getByLabel('Chữ số 1').click();
  await page.keyboard.type(code);
};
const finish = (page) => page.getByRole('button', { name: 'Xác nhận và hoàn tất' });

// ---------- form step: panel and validation ----------

test('"Đăng ký công dân" opens the sign-up panel on step 1; "Quay lại đăng nhập" and Escape return to the login form', async ({ page }) => {
  const { calls } = await openRegister(page, 'citizen');
  await expect(stepNow(page)).toHaveText('Thông tin');
  await expect(page.getByLabel('Các bước đăng ký').locator('li')).toHaveText(['1Thông tin', '2Xác minh SĐT', '3Hoàn tất']);
  await expect(page.getByText('Chúng tôi gửi mã OTP qua SMS để xác minh số điện thoại nhận cảnh báo khẩn cấp.')).toBeVisible();
  await expect(page.locator('#rg-unit')).toHaveCount(0); // citizens have no unit field

  await page.getByRole('button', { name: 'Quay lại đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

  await page.getByRole('button', { name: /Đăng ký công dân/ }).click();
  await expect(page.locator('#rg-name')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  expect(calls).toEqual([]);
});

test('validation: each rule shows its own message and nothing is sent, in the order the form checks them', async ({ page }) => {
  const { calls, sent } = await openRegister(page, 'citizen');
  await next(page).click();
  await expect(alert(page)).toHaveText('Vui lòng điền đầy đủ các thông tin bắt buộc.');

  await fill(page, { phone: '09123' });
  await next(page).click();
  await expect(alert(page)).toHaveText('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại để nhận mã OTP SMS.');

  await fill(page, { pw: 'ngan123', pw2: 'ngan123' });
  await next(page).click();
  await expect(alert(page)).toHaveText('Mật khẩu bảo mật phải có tối thiểu 8 ký tự (theo yêu cầu của máy chủ).');

  await fill(page, { pw2: 'mat-khau-khac-123' });
  await next(page).click();
  await expect(alert(page)).toHaveText('Mật khẩu xác nhận không khớp với mật khẩu đã nhập.');

  await expect(stepNow(page)).toHaveText('Thông tin');
  expect(sent).toEqual([]);
  expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
});

test('a whitespace-only name is the same as an empty one', async ({ page }) => {
  await openRegister(page, 'citizen');
  await fill(page, { name: '    ' });
  await next(page).click();
  await expect(alert(page)).toHaveText('Vui lòng điền đầy đủ các thông tin bắt buộc.');
});

test('the confirm field tells at once whether the two passwords match; the eye button shows and hides them', async ({ page }) => {
  await openRegister(page, 'citizen');
  await expect(page.getByRole('status').filter({ hasText: /khớp/ })).toHaveCount(0); // nothing typed yet
  await page.locator('#rg-pw').fill('mat-khau-dai-123');
  await page.locator('#rg-pw2').fill('mat-khau');
  await expect(page.getByText('Hai mật khẩu chưa khớp.')).toBeVisible();
  await page.locator('#rg-pw2').fill('mat-khau-dai-123');
  await expect(page.getByText('Mật khẩu khớp.')).toBeVisible();

  await expect(page.locator('#rg-pw')).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.locator('#rg-pw')).toHaveAttribute('type', 'text');
  await expect(page.locator('#rg-pw2')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(page.locator('#rg-pw')).toHaveAttribute('type', 'password');
});

// ---------- email already registered ----------

test('leaving the email field of a taken address warns at once; the link goes back to sign-in with the email filled in', async ({ page }) => {
  const { calls, sent } = await openRegister(page, 'citizen', { handler: ({ path }) => (path === '/auth/email-exists' ? { exists: true } : undefined) });
  await page.locator('#rg-email').fill('  da-co@e2e.test ');
  await page.locator('#rg-name').click(); // blur
  await expect(page.getByRole('alert').filter({ hasText: 'Email này đã được đăng ký.' })).toBeVisible();
  await expect(page.locator('#rg-email')).toHaveAttribute('aria-invalid', 'true');
  const url = new URL(await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('/auth/email-exists')).pop()));
  expect(url.searchParams.get('email')).toBe('da-co@e2e.test'); // trimmed
  expect(calls.every((c) => c.method === 'GET')).toBe(true);

  await page.locator('#rg-email').fill('da-co2@e2e.test'); // editing clears the warning
  await expect(page.locator('#rg-email')).not.toHaveAttribute('aria-invalid', 'true');
  await page.locator('#rg-email').fill('da-co@e2e.test');
  await page.locator('#rg-name').click();
  await page.getByRole('button', { name: 'Đăng nhập bằng email này' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.locator('#lg-email')).toHaveValue('da-co@e2e.test');
  expect(sent).toEqual([]);
});

test('submitting a taken email stops before the SMS: no OTP is sent, the email field gets the warning', async ({ page }) => {
  const { sent } = await openRegister(page, 'citizen', { handler: ({ path }) => (path === '/auth/email-exists' ? { exists: true } : undefined) });
  await fill(page);
  await next(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Email này đã được đăng ký.' })).toBeVisible();
  await expect(page.locator('#rg-email')).toBeFocused();
  await expect(stepNow(page)).toHaveText('Thông tin');
  expect(sent).toEqual([]);
});

test('if the email check fails (network) the form goes on and the server decides later', async ({ page }) => {
  const { sent } = await openRegister(page, 'citizen', { handler: ({ path }) => (path === '/auth/email-exists' ? [500, {}] : undefined) });
  await fill(page);
  await toOtp(page);
  expect(sent).toEqual(['0912345678']);
});

// ---------- citizen: OTP step and the request ----------

test('citizen: form -> OTP -> done. The SMS goes to the number without spaces, the account request carries the phone token and no role', async ({ page }) => {
  const { calls, sent, verified } = await openRegister(page, 'citizen', {
    handler: ({ path }) => {
      if (path === '/auth/email-exists') return { exists: false };
      if (path === '/auth/register') return { user: { userId: 'u-new-1' } };
    }
  });
  await fill(page, { email: ' dung@e2e.test'.trim() });
  await next(page).click();

  // step 2
  await expect(stepNow(page)).toHaveText('Xác minh SĐT');
  await expect(page.getByText('+84912345678', { exact: true })).toBeVisible();
  await expect(page.getByText(/Có thể gửi lại mã sau \d+ giây/)).toBeVisible();
  await expect(finish(page)).toBeDisabled();
  expect(sent).toEqual(['0912345678']);
  // the email is checked when its field loses focus and again on submit; both are plain GETs
  expect([...new Set(calls.filter((c) => c.method === 'GET').map((c) => c.path))]).toEqual(['/auth/email-exists']);
  expect(calls.filter((c) => c.method !== 'GET')).toEqual([]); // nothing created yet

  await typeCode(page, '12345');
  await expect(finish(page)).toBeDisabled(); // five digits are not enough
  await page.keyboard.type('6');
  await expect(finish(page)).toBeEnabled();
  await finish(page).click();

  // step 3
  await expect(stepNow(page)).toHaveText('Hoàn tất');
  await expect(page.getByRole('heading', { name: 'Đăng Ký & Xác Thực Số Điện Thoại Thành Công!' })).toBeVisible();
  await expect(page.getByText(/Bạn sẽ nhận được tin nhắn SMS khẩn cấp/)).toBeVisible();
  expect(verified).toEqual([['0912345678', '123456']]);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([{
    method: 'POST', path: '/auth/register',
    body: { fullName: 'Hoàng Văn Dũng', email: 'dung@e2e.test', phoneNumber: '0912345678', phoneToken: 'phone-token-e2e', password: 'mat-khau-dai-123' }
  }]);

  await page.locator('.lg-done').getByRole('button', { name: 'Quay lại đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('OTP boxes: a pasted code fills all six, Backspace walks back, only digits are accepted', async ({ page }) => {
  await openRegister(page, 'citizen');
  await fill(page);
  await toOtp(page);
  const box = (i) => page.getByLabel(`Chữ số ${i}`);
  await box(1).fill('12ab34'); // letters are dropped, digits kept
  await expect(box(1)).toHaveValue('1');
  await expect(box(2)).toHaveValue('2');
  await expect(box(3)).toHaveValue('3');
  await expect(box(4)).toHaveValue('4');
  await expect(box(5)).toHaveValue('');
  await expect(finish(page)).toBeDisabled();
  await page.getByLabel('Chữ số 5').click();
  await page.keyboard.type('56');
  await expect(finish(page)).toBeEnabled();
  await page.keyboard.press('Backspace'); // empties box 6
  await expect(box(6)).toHaveValue('');
  await expect(finish(page)).toBeDisabled();
});

test('"Sửa thông tin" returns to step 1 with everything still filled in', async ({ page }) => {
  await openRegister(page, 'citizen');
  await fill(page);
  await toOtp(page);
  await page.getByRole('button', { name: 'Sửa thông tin' }).click();
  await expect(stepNow(page)).toHaveText('Thông tin');
  await expect(page.locator('#rg-name')).toHaveValue('Hoàng Văn Dũng');
  await expect(page.locator('#rg-email')).toHaveValue('dung@e2e.test');
  await expect(page.locator('#rg-phone')).toHaveValue('0912 345 678');
  await expect(page.locator('#rg-pw')).toHaveValue('mat-khau-dai-123');
});

test('a wrong code shows the OTP error and creates no account; the code can be retyped', async ({ page }) => {
  const { calls, verified } = await openRegister(page, 'citizen', { sms: { verifyError: 'Mã OTP không đúng với tin nhắn SMS gửi về điện thoại của bạn.' } });
  await fill(page);
  await toOtp(page);
  await typeCode(page, '000000');
  await finish(page).click();
  await expect(alert(page)).toHaveText('Mã OTP không đúng với tin nhắn SMS gửi về điện thoại của bạn.');
  expect(verified).toEqual([['0912345678', '000000']]);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
  await page.getByLabel('Chữ số 6').click();
  await page.keyboard.press('Backspace'); // typing again clears the error
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('if the SMS cannot be sent the error is shown on the form and the user stays on step 1', async ({ page }) => {
  const { sent } = await openRegister(page, 'citizen', { sms: { sendError: 'Đã đạt hạn mức SMS tối đa trong ngày của Firebase (10 SMS/ngày).' } });
  await fill(page);
  await next(page).click();
  await expect(alert(page)).toHaveText('Không thể gửi mã OTP SMS: Đã đạt hạn mức SMS tối đa trong ngày của Firebase (10 SMS/ngày).');
  await expect(stepNow(page)).toHaveText('Thông tin');
  await expect(next(page)).toBeEnabled();
  expect(sent).toEqual(['0912345678']);
});

test('the resend link appears after the 60 s countdown, sends a second SMS and restarts the countdown', async ({ page }) => {
  await page.clock.install();
  const { sent } = await openRegister(page, 'citizen');
  await fill(page);
  await toOtp(page);
  await expect(page.getByText('Có thể gửi lại mã sau 60 giây')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi lại mã qua SMS' })).toHaveCount(0);
  await page.clock.runFor(30_000);
  await expect(page.getByText('Có thể gửi lại mã sau 30 giây')).toBeVisible();
  await page.clock.runFor(31_000);
  await expect(page.getByRole('button', { name: 'Gửi lại mã qua SMS' })).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lại mã qua SMS' }).click();
  await expect(page.getByText(/Có thể gửi lại mã sau (60|59) giây/)).toBeVisible();
  expect(sent).toEqual(['0912345678', '0912345678']);
});

// ---------- server error mapping on the final request ----------

const rejects = [
  ['409', [409, { message: 'dup' }], 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.'],
  ['400 about the phone token', [400, { message: 'Phone number must be verified first' }], 'Số điện thoại chưa được xác minh bằng mã OTP. Vui lòng gửi lại mã và nhập đúng.'],
  ['400 with a message', [400, { message: 'Họ tên quá dài.' }], 'Họ tên quá dài.'],
  ['400 without a message', [400, {}], 'Thông tin đăng ký chưa hợp lệ.'],
  ['500', [500, {}], 'Đăng ký không thành công (mã lỗi 500).']
];
for (const [name, response, message] of rejects) {
  test(`citizen: ${name} from /auth/register shows "${message}" on the OTP step and no success screen`, async ({ page }) => {
    await openRegister(page, 'citizen', { handler: ({ path }) => (path === '/auth/register' ? response : undefined) });
    await fill(page);
    await toOtp(page);
    await typeCode(page, '123456');
    await finish(page).click();
    await expect(alert(page)).toHaveText(message);
    await expect(stepNow(page)).toHaveText('Xác minh SĐT');
    await expect(page.getByRole('heading', { name: /Thành Công/ })).toHaveCount(0);
    await expect(finish(page)).toBeEnabled(); // can try again
  });
}

test('citizen: an unreachable server shows the cannot-reach message', async ({ page }) => {
  await openRegister(page, 'citizen');
  await page.route('**/api/v1/auth/register', (route) => route.abort('connectionrefused')); // registered last, wins
  await fill(page);
  await toOtp(page);
  await typeCode(page, '123456');
  await finish(page).click();
  await expect(alert(page)).toHaveText('Không kết nối được máy chủ. Vui lòng thử lại sau.');
});

// ---------- officer ----------

test('officer: asks for the work unit, explains the approval, and refuses a missing unit before anything is sent', async ({ page }) => {
  const { calls, sent } = await openRegister(page, 'officer');
  await expect(page.getByText('Sau khi xác minh số điện thoại, hồ sơ được gửi tới Quản trị viên. Bạn chỉ đăng nhập được khi hồ sơ được duyệt.')).toBeVisible();
  await expect(page.locator('#rg-unit')).toBeVisible();
  await fill(page, { unit: '   ' });
  await next(page).click();
  await expect(alert(page)).toHaveText('Vui lòng nhập đơn vị công tác để Quản trị viên xét duyệt.');
  expect(sent).toEqual([]);
  expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
});

test('officer: form -> OTP -> done. The request goes to /auth/officer-requests with the unit and the phone token, and shows the request code', async ({ page }) => {
  const { calls, verified } = await openRegister(page, 'officer', {
    handler: ({ path }) => (path === '/auth/officer-requests' ? { requestId: 'REQ-2026-0042' } : undefined)
  });
  await fill(page, { name: 'Nguyễn Văn Huy', email: 'huy@e2e.test', phone: '0987654321', unit: ' Chi cục Thủy lợi & PCTT Tỉnh Yên Bái ' });
  await toOtp(page);
  await typeCode(page, '654321');
  await finish(page).click();

  await expect(page.getByRole('heading', { name: 'Đã Gửi Hồ Sơ Cán Bộ!' })).toBeVisible();
  await expect(page.getByText('Mã hồ sơ tiếp nhận')).toBeVisible();
  await expect(page.getByText('REQ-2026-0042')).toBeVisible();
  await expect(page.getByText(/bạn chỉ đăng nhập được sau khi được duyệt/)).toBeVisible();
  expect(verified).toEqual([['0987654321', '654321']]);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([{
    method: 'POST', path: '/auth/officer-requests',
    body: { fullName: 'Nguyễn Văn Huy', email: 'huy@e2e.test', phoneNumber: '0987654321', phoneToken: 'phone-token-e2e', departmentUnit: 'Chi cục Thủy lợi & PCTT Tỉnh Yên Bái', password: 'mat-khau-dai-123' }
  }]);
  expect(calls.some((c) => c.path === '/auth/register')).toBe(false); // officers do not use the citizen endpoint
});

test('officer: a 409 from /auth/officer-requests shows the duplicate-email message', async ({ page }) => {
  await openRegister(page, 'officer', { handler: ({ path }) => (path === '/auth/officer-requests' ? [409, {}] : undefined) });
  await fill(page, { unit: 'Ban Chỉ huy PCTT' });
  await toOtp(page);
  await typeCode(page, '123456');
  await finish(page).click();
  await expect(alert(page)).toHaveText('Email này đã được đăng ký. Hãy đăng nhập hoặc dùng email khác.');
});

test('opening the other sign-up form starts empty: nothing typed before is carried over', async ({ page }) => {
  await openRegister(page, 'citizen');
  await fill(page, { name: 'Người Cũ', email: 'cu@e2e.test' });
  await page.getByRole('button', { name: 'Quay lại đăng nhập' }).click();
  await page.getByRole('button', { name: /Yêu cầu tài khoản cán bộ/ }).click();
  await expect(page.getByRole('heading', { name: 'Yêu cầu tài khoản cán bộ' })).toBeVisible();
  await expect(page.locator('#rg-name')).toHaveValue('');
  await expect(page.locator('#rg-email')).toHaveValue('');
  await expect(page.locator('#rg-unit')).toHaveValue('');
});
