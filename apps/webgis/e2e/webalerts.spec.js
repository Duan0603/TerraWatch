import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Web-only demo flow: a citizen follows an area on the web, the officer sees how many follow it,
// the admin can broadcast to them although no phone is registered, and the citizen's page pops the alert up.

const ALERT = (id, extra = {}) => ({
  broadcastId: id, title: 'CẢNH BÁO SẠT LỞ ĐẤT KHẨN CẤP (HIGH)', message: 'Sơ tán ngay khỏi khu vực Ô 002.', severity: 'high',
  areaName: 'Vùng trọng điểm 2: Sa Pa & Bát Xát (Lào Cai)', issuedAt: new Date().toISOString(),
  validUntil: new Date(Date.now() + 6 * 3600e3).toISOString(), status: 'active', expired: false, ...extra
});

test('officer: each card shows how many citizens follow its area', async ({ page }) => {
  const other = forecastItem('run-2', 'Ô Vùng Khác E2E', 'medium');
  other.unit.areaId = 2;
  await mockBackend(page, 'officer', ({ path, query }) => {
    if (path === '/forecasts/review-queue') return [forecastItem('run-1', 'Ô Có Người Theo Dõi E2E', 'high'), other];
    if (path === '/notifications/broadcast/preview') return { subscribers: query.areaId === '1' ? 2 : 0, devices: 0, smsSubscribers: 0 };
  });
  await page.goto('/');
  const card = (name) => page.locator('.event-card', { hasText: name });
  await expect(card('Ô Có Người Theo Dõi E2E')).toContainText('2 người dân đăng ký nhận cảnh báo vùng này');
  await expect(card('Ô Vùng Khác E2E')).toContainText('Chưa có người dân đăng ký vùng này');
});

test('admin can broadcast to an area whose followers have no phone: they see it on the web', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => {
    if (path === '/forecasts/review-queue') return [forecastItem('run-1', 'Ô Web E2E', 'high', { reviewStatus: 'approved' })];
    if (path === '/monitoring-areas') return [{ area_id: 1, name: 'Khu E2E Yên Bái', is_active: true, geometry_geojson: null }];
    if (path === '/notifications/broadcast/preview') return { subscribers: 1, devices: 0, smsSubscribers: 0 };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Phát cảnh báo' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Khu vực phát cảnh báo')).toHaveValue('1');
  await dialog.getByRole('button', { name: /Tiếp Tục Xác Nhận Phát Lệnh/ }).click();
  await expect(dialog).toContainText('Sẽ hiện trên trang web/app của 1 người đã đăng ký');
  await dialog.getByPlaceholder('XAC NHAN').fill('XAC NHAN');
  await expect(dialog.getByRole('button', { name: /XÁC NHẬN PHÁT LỆNH NGAY/ })).toBeEnabled();
});

test('citizen: an active alert pops up once; "Tôi đã biết" closes it for good, revoked and expired ones never pop', async ({ page }) => {
  await mockBackend(page, 'citizen', ({ path }) => {
    if (path === '/alerts/broadcasts') return [ALERT('b-live'), ALERT('b-old', { status: 'revoked' }), ALERT('b-exp', { expired: true })];
  });
  await page.goto('/');
  const popup = page.getByRole('alertdialog', { name: 'CẢNH BÁO SẠT LỞ KHẨN CẤP' });
  await expect(popup).toContainText('Sơ tán ngay khỏi khu vực Ô 002.');
  await expect(popup).toContainText('Vùng trọng điểm 2: Sa Pa & Bát Xát (Lào Cai)');
  await expect(popup.getByRole('link', { name: /Gọi 112/ })).toHaveAttribute('href', 'tel:112');
  await popup.getByRole('button', { name: 'Tôi đã biết' }).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByLabel('Cảnh báo đã nhận trong 7 ngày qua')).toContainText('Sơ tán ngay khỏi khu vực Ô 002.');

  await page.reload();
  await expect(page.getByLabel('Cảnh báo đã nhận trong 7 ngày qua')).toContainText('Còn hiệu lực');
  await expect(popup).toHaveCount(0);
});
