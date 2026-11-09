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
  await dialog.locator('select').selectOption({ label: 'Khu E2E Yên Bái' });
  await expect(dialog).toContainText('Người nhận dự kiến: 3 người đăng ký Push, 5 thiết bị.');

  await dialog.getByRole('button', { name: /Tiếp Tục Xác Nhận Phát Lệnh/ }).click();
  await expect(dialog).toContainText('XÁC NHẬN BÁO ĐỘNG ĐỎ KHẨN CẤP');
  await expect(dialog).toContainText('Sẽ gửi tới 5 thiết bị của 3 người đăng ký.');

  // Two-step safety: the send button needs the typed phrase. We unlock it, then stop.
  const send = dialog.getByRole('button', { name: /XÁC NHẬN PHÁT LỆNH NGAY/ });
  await expect(send).toBeDisabled();
  await dialog.getByPlaceholder('XAC NHAN').fill('XAC NHAN');
  await expect(send).toBeEnabled();

  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});
