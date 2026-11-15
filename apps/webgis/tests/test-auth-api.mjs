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

// Minimal DOM for the reCAPTCHA host element.
function fakeDom() {
  const byId = new Map();
  const el = (tag) => ({ tag, id: '', style: {}, children: [], appendChild(c) { this.children.push(c); if (c.id) byId.set(c.id, c); return c; }, replaceChildren() { this.children = []; } });
  const body = el('body');
  return { byId, body, document: { body, getElementById: (id) => byId.get(id) || null, createElement: el } };
}

export async function testAuthApi() {
  console.log('\n▶ testAuthApi');
  const { authApi, formatToE164, getOrCreateRecaptcha } = await importSrc('api/authApi.js', { fresh: true });
  const fb = await import('tw-stub:config-firebase');
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

    // --- sendSmsOtp ---
    assert.equal(fb.auth, null);
    await rejects(() => authApi.sendSmsOtp('0865396352'), (e) => assert.match(e.message, /chưa được cấu hình.*Chưa có mã OTP nào được gửi/));
    console.log('  ✓ sendSmsOtp: chưa cấu hình Firebase -> báo lỗi, không gửi gì');

    const dom = fakeDom();
    const win = {};
    restore.push(setGlobal('document', dom.document), setGlobal('window', win));
    const fakeAuth = { name: 'fake-auth' };
    fb.__setAuth(fakeAuth);
    const verifiers = [];
    const sent = [];
    globalThis.__tw = {
      makeVerifier: (a, element, opts) => { const v = { a, element, opts, cleared: 0, rendered: 0, async render() { this.rendered++; }, clear() { this.cleared++; } }; verifiers.push(v); return v; },
      signInWithPhoneNumber: async (a, phone, verifier) => { sent.push({ a, phone, verifier }); return { confirm: async () => ({}) }; }
    };
    const res = await authApi.sendSmsOtp('0865396352');
    assert.equal(res.success, true);
    assert.equal(res.isRealSms, true);
    assert.equal(res.formattedPhone, '+84865396352');
    assert.match(res.message, /\+84865396352/);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].a, fakeAuth);
    assert.equal(sent[0].phone, '+84865396352');
    assert.equal(sent[0].verifier, verifiers[0]);
    assert.equal(verifiers[0].opts.size, 'invisible');
    assert.equal(verifiers[0].rendered, 1);
    assert.equal(win.recaptchaVerifier, verifiers[0]);
    assert.equal(win.confirmationResult !== undefined, true);
    const host = dom.byId.get('recaptcha-container');
    assert.ok(host && dom.body.children.includes(host), 'host attached to body');
    assert.equal(host.children.length, 1);
    console.log('  ✓ sendSmsOtp: chuẩn hoá số, tạo reCAPTCHA ẩn, gọi Firebase, trả kết quả');

    // gửi lại: dọn verifier cũ, dùng phần tử mới, không tạo thêm host
    const firstElement = host.children[0];
    await authApi.sendSmsOtp('0865396352');
    assert.equal(verifiers[0].cleared, 1);
    assert.equal(verifiers.length, 2);
    assert.equal(dom.body.children.length, 1);
    assert.equal(host.children.length, 1);
    assert.notEqual(host.children[0], firstElement);
    win.recaptchaVerifier = { clear() { throw new Error('already disposed'); } };
    await getOrCreateRecaptcha('recaptcha-container'); // clear() ném lỗi thì bị bỏ qua
    console.log('  ✓ gửi lại: clear verifier cũ (lỗi clear bị nuốt), phần tử mới, dùng lại host');

    // map lỗi Firebase
    const fbErr = async (code, message = 'raw firebase message') => {
      globalThis.__tw.signInWithPhoneNumber = async () => { throw Object.assign(new Error(message), { code }); };
      return rejects(() => authApi.sendSmsOtp('0865396352'), () => {});
    };
    assert.match((await fbErr('auth/invalid-phone-number')).message, /không đúng định dạng quốc tế/);
    assert.match((await fbErr('auth/too-many-requests')).message, /hạn mức SMS tối đa trong ngày/);
    assert.match((await fbErr('auth/quota-exceeded')).message, /hết hạn mức SMS/);
    assert.match((await fbErr('auth/billing-not-enabled')).message, /chưa bật thanh toán/);
    assert.equal((await fbErr('auth/argument-error', 'bad el')).message, 'Lỗi cấu hình phần tử reCAPTCHA: bad el');
    assert.equal((await fbErr('auth/something-else')).message, 'raw firebase message');
    console.log('  ✓ sendSmsOtp: ánh xạ 5 mã lỗi Firebase, mã lạ giữ nguyên thông điệp');

    // --- verifySmsOtp ---
    // fresh module: chưa có confirmationResult nào
    const fresh = await importSrc('api/authApi.js', { fresh: true });
    delete win.confirmationResult;
    await rejects(() => fresh.authApi.verifySmsOtp('0865396352', '123456'), (e) => assert.match(e.message, /Chưa có mã OTP nào được gửi/));
    const codes = [];
    win.confirmationResult = { confirm: async (c) => { codes.push(c); return { user: { uid: 'u1', getIdToken: async () => 'id-token' } }; } };
    const ok = await fresh.authApi.verifySmsOtp('0865396352', '123456');
    assert.deepEqual(codes, ['123456']);
    assert.equal(ok.success, true);
    assert.equal(ok.idToken, 'id-token');
    assert.equal(ok.user.uid, 'u1');
    win.confirmationResult = { confirm: async () => ({ user: { uid: 'u2' } }) }; // không có getIdToken
    assert.equal((await fresh.authApi.verifySmsOtp('x', '1')).idToken, undefined);
    const confirmFails = async (code, message) => {
      win.confirmationResult = { confirm: async () => { throw Object.assign(new Error(message), { code }); } };
      return rejects(() => fresh.authApi.verifySmsOtp('x', '1'), () => {});
    };
    assert.match((await confirmFails('auth/invalid-verification-code')).message, /Mã OTP không đúng/);
    assert.match((await confirmFails('auth/code-expired')).message, /đã hết hạn/);
    assert.equal((await confirmFails('auth/other', 'boom')).message, 'boom');
    assert.equal((await confirmFails('auth/other', '')).message, 'Mã OTP không chính xác.');
    console.log('  ✓ verifySmsOtp: chưa gửi mã -> lỗi, trả idToken, ánh xạ lỗi mã sai/hết hạn/khác');
  } finally {
    console.error = origErr;
    fb.__setAuth(null);
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
