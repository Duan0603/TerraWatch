import assert from 'node:assert/strict';
import { importSrc, setGlobal, fakeStorage } from './helpers/load-src.mjs';

// HTTP layer = stub axiosClient (tests/helpers/stub-loader.mjs) that records every call and replies from `reply`.
function recorder(reply = async () => ({})) {
  const calls = [];
  globalThis.__tw = { http: async (method, url, ...rest) => { calls.push({ method, url, args: rest }); return reply(method, url, ...rest); } };
  return calls;
}
const http = (status, message) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: message ? { message } : {} } });
const netErr = () => new Error('Network Error');
const rejects = async (fn, check) => { try { await fn(); } catch (e) { return check(e), e; } assert.fail('expected rejection'); };

export async function testAuthApi() {
  console.log('\n▶ testAuthApi');
  const { authApi, formatToE164 } = await importSrc('api/authApi.js', { fresh: true });
  const restore = [];
  const origErr = console.error; console.error = () => {};
  try {
    // --- formatToE164 ---
    assert.equal(formatToE164('0865396352'), '+84865396352');
    assert.equal(formatToE164(' 0865 396-352 '), '+84865396352');
    assert.equal(formatToE164('+84865396352'), '+84865396352');
    assert.equal(formatToE164('+1 (415) 555-0100'), '+14155550100');
    assert.equal(formatToE164('865396352'), '+84865396352');
    assert.equal(formatToE164(''), '+84');
    assert.equal(formatToE164(null), '+84');
    console.log('  ✓ formatToE164: 0xxx -> +84xxx, giữ + quốc tế, bỏ ký tự thừa, rỗng/null không ném lỗi');

    // --- login ---
    let calls = recorder(async () => ({ token: 'jwt', user: { role: 'officer' } }));
    assert.deepEqual(await authApi.login({ email: 'a@b.vn', password: 'pw', extra: 'ignored' }), { token: 'jwt', user: { role: 'officer' } });
    assert.deepEqual(calls, [{ method: 'post', url: '/auth/login', args: [{ email: 'a@b.vn', password: 'pw' }] }]);
    const e401 = http(401);
    recorder(async () => { throw e401; });
    await rejects(() => authApi.login({ email: 'a@b.vn', password: 'x' }), (e) => assert.equal(e, e401));
    console.log('  ✓ login: POST /auth/login chỉ gửi email+password, trả dữ liệu, ném lại đúng lỗi gốc');

    // --- getCurrentUser ---
    restore.push(setGlobal('localStorage', fakeStorage({ terrawatch_user: '{"id":7,"role":"admin"}' })));
    calls = recorder(async () => ({ id: 1 }));
    assert.deepEqual(await authApi.getCurrentUser(), { id: 1 });
    assert.deepEqual(calls, [{ method: 'get', url: '/auth/me', args: [] }]);
    const e403 = http(403);
    recorder(async () => { throw e403; });
    await rejects(() => authApi.getCurrentUser(), (e) => assert.equal(e, e403));
    recorder(async () => { throw netErr(); });
    assert.deepEqual(await authApi.getCurrentUser(), { id: 7, role: 'admin' });
    restore.push(setGlobal('localStorage', fakeStorage()));
    assert.equal(await authApi.getCurrentUser(), null);
    console.log('  ✓ getCurrentUser: GET /auth/me; lỗi HTTP ném lại; mất mạng dùng bản cache, không có cache trả null');

    // --- emailExists / canResetPassword ---
    calls = recorder(async () => ({ exists: true }));
    assert.equal(await authApi.emailExists('  a@b.vn '), true);
    assert.deepEqual(calls, [{ method: 'get', url: '/auth/email-exists', args: [{ params: { email: 'a@b.vn' } }] }]);
    recorder(async () => ({ exists: 'yes' }));
    assert.equal(await authApi.emailExists('a@b.vn'), false);
    recorder(async () => { throw netErr(); });
    assert.equal(await authApi.emailExists('a@b.vn'), false);
    calls = recorder(async () => ({ eligible: true }));
    assert.equal(await authApi.canResetPassword(' a@b.vn ', '+84900000001'), true);
    assert.deepEqual(calls, [{ method: 'post', url: '/auth/password-reset/check', args: [{ email: 'a@b.vn', phoneNumber: '+84900000001' }] }]);
    recorder(async () => ({}));
    assert.equal(await authApi.canResetPassword('a@b.vn', '1'), false);
    recorder(async () => { throw http(500); });
    assert.equal(await authApi.canResetPassword('a@b.vn', '1'), false);
    console.log('  ✓ emailExists / canResetPassword: trim email, chỉ true khi máy chủ trả đúng true, lỗi -> false');

    // --- quên mật khẩu bằng email ---
    calls = recorder(async () => ({}));
    await authApi.requestEmailCode(' a@b.vn ');
    assert.deepEqual(calls[0], { method: 'post', url: '/auth/password-reset/email/request', args: [{ email: 'a@b.vn' }] });
    recorder(async () => ({ resetToken: 'rt-1' }));
    calls = recorder(async () => ({ resetToken: 'rt-1' }));
    assert.equal(await authApi.verifyEmailCode(' a@b.vn ', '123456'), 'rt-1');
    assert.deepEqual(calls[0], { method: 'post', url: '/auth/password-reset/email/verify', args: [{ email: 'a@b.vn', code: '123456' }] });
    calls = recorder(async () => ({}));
    assert.equal(await authApi.completeEmailReset({ email: ' a@b.vn ', resetToken: 'rt-1', newPassword: 'N3w!pass' }), undefined);
    assert.deepEqual(calls[0], { method: 'post', url: '/auth/password-reset/email/complete', args: [{ email: 'a@b.vn', resetToken: 'rt-1', newPassword: 'N3w!pass' }] });
    for (const [name, fn] of [
      ['requestEmailCode', () => authApi.requestEmailCode('a@b.vn')],
      ['verifyEmailCode', () => authApi.verifyEmailCode('a@b.vn', '1')],
      ['completeEmailReset', () => authApi.completeEmailReset({ email: 'a@b.vn', resetToken: 't', newPassword: 'p' })]
    ]) {
      recorder(async () => { throw http(400, 'Mã xác nhận không đúng hoặc đã hết hạn'); });
      await rejects(fn, (e) => { assert.ok(e instanceof Error, name); assert.equal(e.message, 'Mã xác nhận không đúng hoặc đã hết hạn'); });
      recorder(async () => { throw netErr(); });
      await rejects(fn, (e) => assert.match(e.message, /Không kết nối được máy chủ/));
      recorder(async () => { throw http(500); });
      await rejects(fn, (e) => assert.match(e.message, /mã lỗi 500/));
    }
    console.log('  ✓ quên mật khẩu qua email: path/body, trả resetToken, lỗi đổi sang Error tiếng Việt (400/mạng/5xx)');

    // --- resetPassword (OTP) ---
    calls = recorder(async () => ({}));
    await authApi.resetPassword({ email: ' a@b.vn ', phoneNumber: '+84900000001', phoneToken: 'pt', newPassword: 'N3w!pass' });
    assert.deepEqual(calls[0], { method: 'post', url: '/auth/password-reset', args: [{ email: 'a@b.vn', phoneNumber: '+84900000001', phoneToken: 'pt', newPassword: 'N3w!pass' }] });
    const reset = (err) => { recorder(async () => { throw err; }); return rejects(() => authApi.resetPassword({ email: 'a@b.vn' }), () => {}); };
    assert.match((await reset(netErr())).message, /Không kết nối được máy chủ/);
    assert.match((await reset(http(400, 'Invalid phone token'))).message, /Mã OTP không hợp lệ hoặc đã hết hạn/);
    assert.equal((await reset(http(400, 'Password too short'))).message, 'Password too short');
    assert.equal((await reset(http(400))).message, 'Thông tin chưa hợp lệ.');
    assert.match((await reset(http(500))).message, /mã lỗi 500/);
    console.log('  ✓ resetPassword: body, và 5 nhánh lỗi (mạng, token, 400 có/không thông điệp, 5xx)');

    // --- đăng ký ---
    const payload = { email: 'a@b.vn', password: 'pw', phoneToken: 'pt' };
    calls = recorder(async () => ({ requestId: 'REQ-1' }));
    assert.deepEqual(await authApi.registerOfficerRequest(payload), { requestId: 'REQ-1' });
    assert.deepEqual(calls[0], { method: 'post', url: '/auth/officer-requests', args: [payload] });
    calls = recorder(async () => ({ id: 9 }));
    assert.deepEqual(await authApi.registerCitizen(payload), { id: 9 });
    assert.deepEqual(calls[0], { method: 'post', url: '/auth/register', args: [payload] });
    for (const fn of [authApi.registerOfficerRequest, authApi.registerCitizen]) {
      recorder(async () => { throw http(409); });
      await rejects(() => fn(payload), (e) => assert.match(e.message, /Email này đã được đăng ký/));
      recorder(async () => { throw netErr(); });
      await rejects(() => fn(payload), (e) => assert.match(e.message, /Không kết nối được máy chủ/));
      recorder(async () => { throw http(502); });
      await rejects(() => fn(payload), (e) => assert.match(e.message, /mã lỗi 502/));
    }
    console.log('  ✓ registerOfficerRequest / registerCitizen: POST đúng path, truyền nguyên body, lỗi -> Error tiếng Việt');

    // --- logout ---
    const store = fakeStorage({ terrawatch_token: 't', terrawatch_user: '{}', other: 'keep' });
    restore.push(setGlobal('localStorage', store));
    authApi.logout();
    assert.deepEqual(store.keys(), ['other']);
    console.log('  ✓ logout: chỉ xoá terrawatch_token và terrawatch_user');

    // --- sendSmsOtp / verifySmsOtp (Story 4.44: mã do máy chủ tự gửi SMS, không qua Firebase) ---
    calls = recorder(async () => ({ sent: true }));
    const res = await authApi.sendSmsOtp(' 0865 396 352 ');
    assert.deepEqual(calls, [{ method: 'post', url: '/auth/phone-otp/request', args: [{ phoneNumber: '+84865396352' }] }]);
    assert.equal(res.success, true);
    assert.equal(res.formattedPhone, '+84865396352');
    assert.match(res.message, /\+84865396352/);
    const sendFails = (err) => { recorder(async () => { throw err; }); return rejects(() => authApi.sendSmsOtp('0865396352'), () => {}); };
    assert.equal((await sendFails(http(429, 'Vui lòng đợi 60 giây rồi mới gửi lại mã.'))).message, 'Vui lòng đợi 60 giây rồi mới gửi lại mã.');
    assert.match((await sendFails(http(503, 'Máy chủ chưa bật gửi SMS nên chưa gửi được mã.'))).message, /chưa bật gửi SMS/);
    assert.equal((await sendFails(http(500))).message, 'Chưa gửi được mã xác thực.');
    assert.match((await sendFails(netErr())).message, /Không kết nối được máy chủ/);
    console.log('  ✓ sendSmsOtp: POST /auth/phone-otp/request với số +84, lỗi giữ thông điệp máy chủ (429/503), 5xx/mạng có câu riêng');

    calls = recorder(async () => ({ phoneToken: 'pt-1' }));
    const ok = await authApi.verifySmsOtp('0865396352', ' 123456 ');
    assert.deepEqual(calls, [{ method: 'post', url: '/auth/phone-otp/verify', args: [{ phoneNumber: '+84865396352', code: '123456' }] }]);
    assert.equal(ok.success, true);
    assert.equal(ok.idToken, 'pt-1');
    assert.equal((await authApi.verifySmsOtp('+84865396352', '123456')).idToken, 'pt-1');
    assert.equal(calls.length, 1, 'đúng mã vừa xác thực: dùng lại token, không gọi máy chủ lần nữa');
    recorder(async () => ({ sent: true }));
    await authApi.sendSmsOtp('0865396352');
    calls = recorder(async () => ({ phoneToken: 'pt-2' }));
    assert.equal((await authApi.verifySmsOtp('0865396352', '123456')).idToken, 'pt-2');
    assert.equal(calls.length, 1, 'gửi mã mới thì bỏ token cũ');
    const verifyFails = (err) => { recorder(async () => { throw err; }); return rejects(() => authApi.verifySmsOtp('0865396352', '000000'), () => {}); };
    assert.equal((await verifyFails(http(400, 'Mã xác thực không đúng hoặc đã hết hạn'))).message, 'Mã xác thực không đúng hoặc đã hết hạn');
    assert.equal((await verifyFails(http(400))).message, 'Mã OTP không chính xác hoặc đã hết hạn.');
    assert.match((await verifyFails(netErr())).message, /Không kết nối được máy chủ/);
    console.log('  ✓ verifySmsOtp: POST /auth/phone-otp/verify, trả phoneToken, nhớ mã đúng gần nhất, lỗi đổi sang tiếng Việt');
  } finally {
    console.error = origErr;
    restore.reverse().forEach((r) => r());
    delete globalThis.__tw;
  }
  console.log('✅ testAuthApi PASSED!');
}

// BUG: formatToE164('84865396352') (số đã gồm mã quốc gia nhưng thiếu dấu +) được kỳ vọng trả '+84865396352',
// thực tế trả '+8484865396352' vì chỉ nhánh bắt đầu bằng '0' hoặc '+' được xử lý, còn lại luôn thêm '+84'.
// Không đăng ký trong run-all-tests.mjs cho tới khi sửa src/api/authApi.js.
export async function testAuthApiBugPhoneWithCountryCodeNoPlus() {
  const { formatToE164 } = await importSrc('api/authApi.js');
  assert.equal(formatToE164('84865396352'), '+84865396352');
}
