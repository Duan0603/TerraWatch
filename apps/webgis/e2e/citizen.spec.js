import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { mockBackend } from './helpers.js';

// Story 4.43: the citizen page tells "is my area safe today?", acts on danger and keeps areas/contacts in the profile.
const box = (x0, y0, x1, y1) => JSON.stringify({ type: 'MultiPolygon', coordinates: [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]] });
const AREAS = [
  { area_id: 1, name: 'Vùng trọng điểm 1: Mù Cang Chải (Yên Bái)', is_active: true, geometry_geojson: box(104.05, 21.8, 104.22, 21.92) },
  { area_id: 4, name: 'Vùng trọng điểm 4: Làng Nủ (Lào Cai)', is_active: true, geometry_geojson: box(104.512, 22.108, 104.548, 22.152) }
];
const POINTS = { type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: null, properties: { key: '21.8600,104.1100', name: 'Quốc Lộ 32 - Bản Dế Xu Phình' } },
  { type: 'Feature', geometry: null, properties: { key: '22.1202,104.5278', name: 'Làng Nủ' } }
] };
const anomaly = (mm, level, f24 = 3) => ({ period: '1998–2026', reference: 'IMERG_V07', history_24h: { mm: 5, level: null, p95: 24.5, p99: 52.3, p99_9: 100, max: 174 }, history_72h: { mm, level, p95: 60.7, p99: 102.6, p99_9: 165.4 }, forecast_24h: { mm: f24, level: null, p95: 24.5 } });
// a real GIS live payload (the weather panel beside the map reads all of it); each test sets its own rain levels
const base = JSON.parse(fs.readFileSync(new URL('./fixtures/live-point.json', import.meta.url), 'utf8')).data;
const LIVE = {
  21.86: { success: true, data: { ...base, rain_anomaly: anomaly(110.2, 'p99') } },
  22.1202: { success: true, data: { ...base, rain_anomaly: anomaly(240, 'p99_9'), rain_warning: {
    now: { complete: true, level: 'danger', totals_mm: { 72: 246.7 } }, next_24h: { complete: true, level: 'danger' } } } }
};
const ME = { userId: 'u1', fullName: 'Vũ Hải Lâm', phoneNumber: '0912345678', province: 'Lào Cai', district: 'Bảo Yên', commune: 'Phúc Khánh',
  emergencyContactName: 'Vũ Thị B', emergencyContactPhone: '0987654321', emergencyContactRelation: 'Mẹ', role: 'citizen' };

function backend(page, { subs, me = ME }) {
  let mine = subs;
  let profile = me;
  return mockBackend(page, 'citizen', ({ method, path, query, body }) => {
    if (path === '/monitoring-areas') return AREAS;
    if (path === '/gis/rainfall/live/map') return POINTS;
    if (path === '/gis/rainfall/live') return LIVE[Number(query.latitude)] || [404, {}];
    if (path === '/auth/me' && method === 'GET') return profile;
    if (path === '/auth/me' && method === 'PUT') { profile = { ...profile, ...body }; return profile; }
    if (path === '/alerts/subscriptions' && method === 'GET') return mine;
    if (path === '/alerts/subscriptions' && method === 'POST') {
      const s = { subscriptionId: `s${body.areaId}`, areaId: body.areaId, alertChannels: body.alertChannels };
      mine = [...mine.filter((x) => x.areaId !== body.areaId), s];
      return s;
    }
  });
}

test('followed areas show today\'s level, the danger banner gives calls, and the header sums it up', async ({ page }) => {
  await backend(page, { subs: [{ subscriptionId: 's1', areaId: 1, alertChannels: ['SMS'] }, { subscriptionId: 's4', areaId: 4, alertChannels: ['PUSH', 'SMS'] }] });
  await page.goto('/');
  const today = page.getByRole('region', { name: 'Hôm nay ở khu vực của bạn' });
  const mcc = today.getByRole('group', { name: 'Tình trạng Mù Cang Chải (Yên Bái)' });
  await expect(mcc).toContainText('Cảnh báo');
  await expect(mcc).toContainText('Mưa 3 ngày qua: 110,2 mm (mức hay gặp ở đây: dưới 60,7 mm)');
  await expect(mcc).toContainText('Chuẩn bị sơ tán');
  const ln = today.getByRole('group', { name: 'Tình trạng Làng Nủ (Lào Cai)' });
  await expect(ln).toContainText('Nguy hiểm');
  await expect(ln).toContainText('246,7 mm');
  await expect(ln.getByRole('button', { name: /Xem dòng bùn đá/ })).toBeVisible();
  await expect(mcc.getByRole('button', { name: /Xem dòng bùn đá/ })).toHaveCount(0); // only Làng Nủ has the extent model

  const banner = page.getByRole('alert', { name: 'Cần hành động ngay' });
  await expect(banner).toContainText('Nguy hiểm: Mù Cang Chải (Yên Bái), Làng Nủ (Lào Cai)');
  await expect(banner).toContainText('Sơ tán ngay');
  await expect(banner.getByRole('link', { name: /Gọi 112/ })).toHaveAttribute('href', 'tel:112');
  await expect(banner.getByRole('link', { name: /Gọi Vũ Thị B \(Mẹ\)/ })).toHaveAttribute('href', 'tel:0987654321');
  await expect(page.getByLabel('Tình trạng khu vực của bạn')).toHaveText('Khu vực của bạn hôm nay: Nguy hiểm');
  await expect(page.getByText('Cảnh báo chính thức từ cán bộ (0)')).toBeVisible();
  // with areas already chosen, the card still leads to the area list
  await today.getByRole('button', { name: 'Thêm / đổi khu vực' }).click();
  await expect(page.getByRole('dialog', { name: 'Hồ sơ của tôi' }).getByText('Khu vực của tôi')).toBeVisible();
});

test('without areas the page asks to choose one; choosing it in the profile shows its status', async ({ page }) => {
  await backend(page, { subs: [] });
  await page.goto('/');
  const today = page.getByRole('region', { name: 'Hôm nay ở khu vực của bạn' });
  await expect(today).toContainText('Bạn chưa chọn khu vực sinh sống');
  await expect(page.getByLabel('Tình trạng khu vực của bạn')).toHaveText('Chưa chọn khu vực của bạn');
  await today.getByRole('button', { name: 'Chọn khu vực của tôi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Hồ sơ của tôi' });
  await dialog.getByLabel('Mù Cang Chải (Yên Bái): nhận SMS').click();
  await expect(dialog.getByLabel('Mù Cang Chải (Yên Bái): nhận SMS')).toBeChecked();
  await dialog.getByRole('button', { name: 'Đóng hồ sơ' }).click();
  await expect(today.getByRole('group', { name: 'Tình trạng Mù Cang Chải (Yên Bái)' })).toContainText('Cảnh báo');
});

test('the profile saves address and emergency contact, which becomes a call button', async ({ page }) => {
  const calls = await backend(page, { subs: [], me: { userId: 'u1', fullName: 'Vũ Hải Lâm', phoneNumber: '0912345678', role: 'citizen' } });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Thêm người liên hệ khẩn cấp/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mở hồ sơ của tôi' }).click();
  const dialog = page.getByRole('dialog', { name: 'Hồ sơ của tôi' });
  await dialog.getByLabel('Xã / phường').fill('Phúc Khánh');
  await dialog.getByLabel('Họ tên', { exact: true }).fill('Vũ Thị B');
  await dialog.getByLabel('Số điện thoại', { exact: true }).fill('12345');
  await dialog.getByRole('button', { name: 'Lưu hồ sơ' }).click();
  await expect(dialog.getByRole('alert')).toContainText('0 và 9 số');
  await dialog.getByLabel('Số điện thoại', { exact: true }).fill('0987 654 321');
  await dialog.getByLabel('Quan hệ').fill('Mẹ');
  await dialog.getByRole('button', { name: 'Lưu hồ sơ' }).click();
  await expect(dialog.getByRole('status')).toContainText('Đã lưu hồ sơ');
  const put = calls.find((c) => c.method === 'PUT' && c.path === '/auth/me');
  expect(put.body).toMatchObject({ fullName: 'Vũ Hải Lâm', phoneNumber: '0912345678', commune: 'Phúc Khánh',
    emergencyContactName: 'Vũ Thị B', emergencyContactPhone: '0987654321', emergencyContactRelation: 'Mẹ' });
  await dialog.getByRole('button', { name: 'Đóng hồ sơ' }).click();
  await expect(page.getByRole('link', { name: /Gọi Vũ Thị B \(Mẹ\)/ })).toHaveAttribute('href', 'tel:0987654321');
});

test('my current position tells my area and its rain, and one click follows it', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 21.861, longitude: 104.112 });
  const calls = await backend(page, { subs: [] });
  await page.goto('/');
  const here = page.getByRole('group', { name: 'Vị trí hiện tại của bạn' });
  await here.getByRole('button', { name: 'Lấy vị trí hiện tại của tôi' }).click();
  await expect(here).toContainText('Bạn đang ở trong khu vực Mù Cang Chải (Yên Bái)');
  await expect(here).toContainText('Mưa ở chỗ bạn: Cảnh báo');
  await expect(here).toContainText('110,2 mm trong 3 ngày');
  await here.getByRole('button', { name: 'Theo dõi khu vực Mù Cang Chải (Yên Bái)' }).click();
  await expect(here).toContainText('Bạn đã theo dõi khu vực này');
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ areaId: 1, alertChannels: ['PUSH', 'SMS'] });
  await expect(page.getByRole('group', { name: 'Tình trạng Mù Cang Chải (Yên Bái)' })).toContainText('Cảnh báo');
});
