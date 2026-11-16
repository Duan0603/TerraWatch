import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Story 4.42: a citizen picks alert areas and channels on the web; SMS asks for a phone first.
const AREAS = [
  { area_id: 1, name: 'Vùng trọng điểm 1: Mù Cang Chải (Yên Bái)', is_active: true },
  { area_id: 2, name: 'Vùng trọng điểm 2: Sa Pa & Bát Xát (Lào Cai)', is_active: true }
];

test('citizen subscribes an area by SMS (asks for a phone), adds app push, unsubscribes and changes the phone', async ({ page }) => {
  let subs = [];
  let me = { userId: 'u1', fullName: 'Vũ Hải Lâm', phoneNumber: null, province: 'Lào Cai', role: 'citizen' };
  const calls = await mockBackend(page, 'citizen', ({ method, path, body }) => {
    if (path === '/monitoring-areas') return AREAS;
    if (path === '/auth/me' && method === 'GET') return me;
    if (path === '/auth/me' && method === 'PUT') { me = { ...me, ...body }; return me; }
    if (path === '/alerts/subscriptions' && method === 'GET') return subs;
    if (path === '/alerts/subscriptions' && method === 'POST') {
      if (body.phoneNumber) me = { ...me, phoneNumber: body.phoneNumber };
      const s = { subscriptionId: `s${body.areaId}`, areaId: body.areaId, areaName: AREAS[body.areaId - 1].name, alertChannels: body.alertChannels };
      subs = [...subs.filter((x) => x.areaId !== body.areaId), s];
      return s;
    }
    if (path.startsWith('/alerts/subscriptions/') && method === 'DELETE') { subs = subs.filter((x) => `/alerts/subscriptions/${x.subscriptionId}` !== path); return [204, null]; }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở hồ sơ của tôi' }).click(); // Story 4.43: the card lives in the profile
  const card = page.getByRole('dialog', { name: 'Hồ sơ của tôi' }).getByRole('region', { name: 'Nhận cảnh báo theo khu vực' });
  await expect(card).toContainText('Chưa có số điện thoại nhận SMS');
  await expect(card).toContainText('Chưa chọn khu vực nào');

  // SMS without a phone: the card asks for one, rejects a bad number, then subscribes with it
  await card.getByLabel('Mù Cang Chải (Yên Bái): nhận SMS').click();
  const phone = card.getByLabel('Số điện thoại nhận SMS');
  await phone.fill('12345');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card.getByRole('alert')).toContainText('0 và 9 số');
  await phone.fill('0912 345 678');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card).toContainText('SMS gửi tới 091****678');
  await expect(card.getByLabel('Mù Cang Chải (Yên Bái): nhận SMS')).toBeChecked();
  await expect(card).toContainText('Đang nhận cảnh báo cho 1 khu vực');
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ areaId: 1, alertChannels: ['SMS'], phoneNumber: '0912345678' });

  // add app push: channels updated, no phone sent again
  await card.getByLabel('Mù Cang Chải (Yên Bái): nhận thông báo app').click();
  await expect(card.getByLabel('Mù Cang Chải (Yên Bái): nhận thông báo app')).toBeChecked();
  expect(calls.filter((c) => c.method === 'POST').at(-1).body).toEqual({ areaId: 1, alertChannels: ['PUSH', 'SMS'] });

  // both off = unsubscribe
  await card.getByLabel('Mù Cang Chải (Yên Bái): nhận SMS').click();
  await card.getByLabel('Mù Cang Chải (Yên Bái): nhận thông báo app').click();
  await expect(card).toContainText('Chưa chọn khu vực nào');
  expect(calls.some((c) => c.method === 'DELETE' && c.path === '/alerts/subscriptions/s1')).toBe(true);

  // change the phone: PUT /auth/me keeps the other profile fields
  await card.getByRole('button', { name: 'Đổi số' }).click();
  await card.getByLabel('Số điện thoại nhận SMS').fill('0987654321');
  await card.getByRole('button', { name: 'Lưu' }).click();
  await expect(card).toContainText('SMS gửi tới 098****321');
  const put = calls.find((c) => c.method === 'PUT');
  expect(put.body).toMatchObject({ fullName: 'Vũ Hải Lâm', province: 'Lào Cai', phoneNumber: '0987654321' });
});

test('a failed save shows the error and keeps the toggle off', async ({ page }) => {
  await mockBackend(page, 'citizen', ({ method, path }) => {
    if (path === '/monitoring-areas') return AREAS;
    if (path === '/auth/me') return { fullName: 'A', phoneNumber: '0912345678' };
    if (path === '/alerts/subscriptions' && method === 'POST') return [500, { message: 'x' }];
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở hồ sơ của tôi' }).click(); // Story 4.43: the card lives in the profile
  const card = page.getByRole('dialog', { name: 'Hồ sơ của tôi' }).getByRole('region', { name: 'Nhận cảnh báo theo khu vực' });
  await card.getByLabel('Sa Pa & Bát Xát (Lào Cai): nhận thông báo app').click();
  await expect(card.getByRole('alert')).toBeVisible();
  await expect(card.getByLabel('Sa Pa & Bát Xát (Lào Cai): nhận thông báo app')).not.toBeChecked();
});
