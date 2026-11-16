import assert from 'node:assert/strict';
import { maskPhone, cleanPhone, channelsFor, shortAreaName, profileWithPhone, PROFILE_FIELDS } from '../src/utils/alertSubscriptions.js';

// Story 4.42: citizen alert areas on the web.
export async function testAlertSubscriptions() {
  console.log('\n▶ testAlertSubscriptions');

  assert.equal(maskPhone('0912345678'), '091****678');
  assert.equal(maskPhone(''), '');
  assert.equal(maskPhone(null), '');

  assert.equal(cleanPhone('0912 345.678'), '0912345678');
  assert.equal(cleanPhone('+84912345678'), '+84912345678');
  assert.equal(cleanPhone('091234567'), null, '9 digits is too short');
  assert.equal(cleanPhone('1912345678'), null, 'must start with 0 or +84');
  assert.equal(cleanPhone('abc'), null);

  assert.deepEqual(channelsFor(true, true), ['PUSH', 'SMS']);
  assert.deepEqual(channelsFor(false, true), ['SMS']);
  assert.deepEqual(channelsFor(false, false), [], 'both off = unsubscribe');

  assert.equal(shortAreaName('Vùng trọng điểm 1: Mù Cang Chải (Yên Bái)'), 'Mù Cang Chải (Yên Bái)');

  // PUT /auth/me clears what is left out, so every other field is re-sent as read
  const me = { fullName: 'Lâm', phoneNumber: '0900000000', province: 'Lào Cai', emergencyContactName: 'Mẹ', email: 'x@y', role: 'citizen' };
  const body = profileWithPhone(me, '0912345678');
  assert.deepEqual(Object.keys(body), PROFILE_FIELDS);
  assert.equal(body.phoneNumber, '0912345678');
  assert.equal(body.province, 'Lào Cai');
  assert.equal(body.emergencyContactName, 'Mẹ');
  assert.equal(body.gender, null);
  assert.ok(!('email' in body) && !('role' in body), 'only profile fields');
  console.log('  ✓ phone mask/validation, channels, profile body for PUT /auth/me');
}

export async function testBroadcastReach() {
  console.log('\n▶ testBroadcastReach');
  const { broadcastReach } = await import('../src/utils/broadcastReach.js');
  assert.equal(broadcastReach(null), null);
  const smsOnly = broadcastReach({ subscribers: 0, devices: 0, smsSubscribers: 1 });
  assert.equal(smsOnly.canSend, true, 'an SMS subscriber alone is enough to send');
  assert.deepEqual(smsOnly.channels, ['SMS']);
  assert.equal(smsOnly.sendText, 'Sẽ gửi tới 1 người nhận SMS.');
  const both = broadcastReach({ subscribers: 3, devices: 5, smsSubscribers: 2 });
  assert.deepEqual(both.channels, ['FCM APP PUSH', 'SMS']);
  assert.equal(both.sendText, 'Sẽ gửi tới 5 thiết bị nhận Push và 2 người nhận SMS.');
  const webOnly = broadcastReach({ subscribers: 1, devices: 0 });
  assert.equal(webOnly.canSend, true, 'an app subscriber without a phone still reads it on the web/app inbox');
  assert.deepEqual(webOnly.channels, ['THÔNG BÁO TRÊN WEB / APP']);
  assert.equal(webOnly.sendText, 'Sẽ hiện trên trang web/app của 1 người đã đăng ký (chưa có điện thoại nhận Push).');
  const none = broadcastReach({ subscribers: 0, devices: 0, smsSubscribers: 0 });
  assert.equal(none.canSend, false, 'nobody following the area blocks the send');
  assert.ok(none.sendText.includes('Không thể phát lệnh'));
  console.log('  ✓ push, SMS or a web/app follower is enough; nobody reachable blocks the send');
}

export async function testSendResultText() {
  console.log('\n▶ testSendResultText');
  const { sendResultText } = await import('../src/utils/broadcastReach.js');
  assert.equal(sendResultText({ total: 0, sent: 0, failed: 0, smsRecipients: 1, smsSent: 1, smsFailed: 0 }),
    'Thông báo app: không có thiết bị. SMS: 1/1 tin.');
  assert.equal(sendResultText({ total: 5, sent: 4, failed: 1, smsRecipients: 2, smsSent: 1, smsFailed: 1, smsError: 'eSMS 103' }),
    'Thông báo app: 4/5 thiết bị (1 lỗi). SMS: 1/2 tin (1 lỗi: eSMS 103).');
  assert.equal(sendResultText({ total: 3, sent: 3, failed: 0, smsRecipients: 0 }), 'Thông báo app: 3/3 thiết bị. SMS: không có người đăng ký.');
  assert.equal(sendResultText({ appSubscribers: 1, total: 0, sent: 0, failed: 0, smsRecipients: 0 }),
    'Trang web/app: 1 người đăng ký. Thông báo app: không có thiết bị. SMS: không có người đăng ký.');
  console.log('  ✓ result line shows push and SMS counts');
}
