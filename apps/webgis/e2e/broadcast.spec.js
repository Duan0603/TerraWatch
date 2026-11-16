import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. The test stops at the confirmation step and proves nothing was posted: no FCM is ever sent.

test('admin previews recipients and reaches the confirmation, without sending', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ path }) => {
    if (path === '/forecasts/review-queue') return [forecastItem('run-high', 'Mù Cang Chải - E2E', 'high', { reviewStatus: 'approved' })];
    if (path === '/monitoring-areas') return [{ area_id: 1, name: 'Khu E2E Yên Bái', is_active: true, geometry_geojson: null }];
    if (path === '/notifications/broadcast/preview') return { subscribers: 3, devices: 5 };
    if (path.includes('/broadcast')) return [500, {}]; // any real send would fail loudly
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Phát cảnh báo' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('PHÁT LỆNH CẢNH BÁO THIÊN TAI KHẨN CẤP');
  await dialog.getByLabel('Khu vực phát cảnh báo').selectOption({ label: 'Khu E2E Yên Bái' });
  await expect(dialog).toContainText('Người nhận dự kiến: 3 người đăng ký Push, 5 thiết bị; 0 người nhận SMS.');

  await dialog.getByRole('button', { name: /Tiếp Tục Xác Nhận Phát Lệnh/ }).click();
  await expect(dialog).toContainText('XÁC NHẬN BÁO ĐỘNG ĐỎ KHẨN CẤP');
  await expect(dialog).toContainText('Sẽ gửi tới 5 thiết bị nhận Push.');

  // Two-step safety: the send button needs the typed phrase. We unlock it, then stop.
  const send = dialog.getByRole('button', { name: /XÁC NHẬN PHÁT LỆNH NGAY/ });
  await expect(send).toBeDisabled();
  await dialog.getByPlaceholder('XAC NHAN').fill('XAC NHAN');
  await expect(send).toBeEnabled();

  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});

test('the basis list offers only approved, unexpired forecasts; picking one fills its area and message and is sent as runId', async ({ page }) => {
  const second = forecastItem('run-b', 'Ô Thứ Hai E2E', 'medium', { reviewStatus: 'approved' });
  second.unit.areaId = 2;
  const calls = await mockBackend(page, 'admin', ({ method, path }) => {
    if (path === '/forecasts/review-queue') return [
      forecastItem('run-a', 'Ô Đã Duyệt E2E', 'high', { reviewStatus: 'approved' }),
      second,
      forecastItem('run-p', 'Ô Chờ E2E', 'high'),
      forecastItem('run-x', 'Ô Hết Hạn E2E', 'high', { reviewStatus: 'approved', expired: true })
    ];
    if (path === '/monitoring-areas') return [
      { area_id: 1, name: 'Khu E2E Yên Bái', is_active: true, geometry_geojson: null },
      { area_id: 2, name: 'Khu E2E Lào Cai', is_active: true, geometry_geojson: null }
    ];
    if (path === '/notifications/broadcast/preview') return { subscribers: 3, devices: 5 };
    if (method === 'POST' && path === '/core/notifications/broadcast') {
      return { broadcast_id: 'b-1', timestamp: new Date().toISOString(), recipients_estimated: 5, sent: 5, failed: 0, status: 'SENT' };
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Phát cảnh báo' }).click();
  const dialog = page.getByRole('dialog');
  const basis = dialog.getByLabel(/CĂN CỨ PHÁT LỆNH/);
  const options = await basis.locator('option').allTextContents();
  expect(options.some((o) => o.includes('Ô Đã Duyệt E2E'))).toBe(true);
  expect(options.some((o) => o.includes('Ô Thứ Hai E2E'))).toBe(true);
  expect(options.some((o) => o.includes('Ô Chờ E2E') || o.includes('Ô Hết Hạn E2E'))).toBe(false);
  await expect(basis).toHaveValue('run-a'); // the selected approved forecast is preset

  await basis.selectOption('run-b');
  await expect(dialog.getByLabel('Khu vực phát cảnh báo')).toHaveValue('2');
  await expect(dialog.locator('textarea')).toHaveValue(/Ô Thứ Hai E2E/);

  await dialog.getByRole('button', { name: /Tiếp Tục Xác Nhận Phát Lệnh/ }).click();
  await expect(dialog).toContainText('Căn cứ: dự báo đã duyệt Ô Thứ Hai E2E');
  await dialog.getByPlaceholder('XAC NHAN').fill('XAC NHAN');
  await dialog.getByRole('button', { name: /XÁC NHẬN PHÁT LỆNH NGAY/ }).click();
  await expect.poll(() => calls.find((c) => c.method === 'POST' && c.path === '/core/notifications/broadcast')?.body)
    .toMatchObject({ runId: 'run-b', areaId: 2 });
});
