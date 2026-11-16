import { test, expect } from '@playwright/test';
import { mockBackend, openTool, openAdminTool, holdGet } from './helpers.js';

// Mocked API. The loading state of the dialogs that had none asserted: the wait text is shown, "empty" and "error" texts are not
// (loading is not empty), and the content appears when the answer comes. UW-AOI-007 (monitoring areas), UW-BRD-002 (broadcast history),
// UW-AUD-002 (admin audit), UW-DASH-107 (system health), UW-DASH-019 (photo in the field report card).
// Already asserted elsewhere: UW-RPT-002 and UW-USR-002 (fieldreportsstates, usermanagementstates), UW-FREV-009 (reviewauditstates),
// UW-DASH-078 (modelcardstates), UW-AUTH-014 ("Đang gửi…", forgotpasswordstates).

const ring = [[104.1, 21.8], [104.3, 21.8], [104.3, 21.95], [104.1, 21.95], [104.1, 21.8]];
const AREA = { area_id: 1, name: 'Vùng Một E2E', description: 'Mô tả', is_active: true, created_at: '2026-10-01T03:00:00Z', geometry_geojson: JSON.stringify({ type: 'Polygon', coordinates: [ring] }) };
const BC = { broadcastId: 'aaaaaaaa-1111-4111-8111-000000000001', sentAt: '2026-10-10T03:00:00Z', areaId: 1, areaName: 'Khu Mù Cang Chải', runId: 'run-a', recipients: 5, sent: 5, failed: 0, status: 'active', message: 'Sơ tán', senderName: 'Admin', severity: 'high' };
const AUDIT = { id: 1, at: '2026-10-10T03:00:00Z', actor: 'admin@e2e.test', action: 'USER_LOCK', targetLabel: 'Cán Bộ Một', targetId: 'u-1', detail: '' };
const HEALTH = { checkedAt: '2026-10-10T03:00:00Z', components: [{ key: 'db', label: 'Cơ sở dữ liệu', status: 'ok', latencyMs: 12, detail: 'ok' }], freshness: [] };

/** Signs in as admin, loads the dashboard, then holds `path` so only the dialog's own request waits. */
async function held(page, path, body, handler) {
  await mockBackend(page, 'admin', handler ?? (() => undefined));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Công cụ' })).toBeVisible();
  return holdGet(page, path, body);
}

test('UW-AOI-007: while the areas load the dialog says "Đang tải..." and not "Không tìm thấy vùng giám sát nào."; the list replaces it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const g = await held(page, '/monitoring-areas', [AREA]);
  await openAdminTool(page, 'Vùng giám sát');
  await expect(page.getByText('Đang tải...')).toBeVisible();
  await expect(page.getByText('Không tìm thấy vùng giám sát nào.')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  g.release();
  await expect(page.getByText('Vùng Một E2E', { exact: true })).toBeVisible();
  await expect(page.getByText('Đang tải...')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('UW-BRD-002: while the history loads the list says "Đang tải lịch sử từ máy chủ…" and not "Không tìm thấy đợt phát lệnh nào."; the entry replaces it', async ({ page }) => {
  const g = await held(page, '/notifications/broadcasts', [BC]);
  await openTool(page, 'Lịch sử lệnh');
  await expect(page.getByText('Đang tải lịch sử từ máy chủ…')).toBeVisible();
  await expect(page.getByText('Không tìm thấy đợt phát lệnh nào.')).toHaveCount(0);
  g.release();
  await expect(page.locator('code', { hasText: 'BC-aaaaaaaa' })).toBeVisible();
  await expect(page.getByText('Đang tải lịch sử từ máy chủ…')).toHaveCount(0);
});

test('UW-AUD-002: while the log loads there is no table, no empty-log text and no error; the row appears after the answer', async ({ page }) => {
  const dlg = page.getByRole('dialog', { name: 'Nhật ký quản trị' });
  const g = await held(page, '/admin/audit', [AUDIT]);
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(dlg.getByTitle('Tải lại')).toBeDisabled(); // the dialog is open and waiting
  await expect(dlg.locator('table')).toHaveCount(0);
  await expect(dlg.getByText('Chưa có thao tác nào được ghi lại.')).toHaveCount(0);
  await expect(dlg.getByRole('alert')).toHaveCount(0);
  await expect(dlg.getByTitle('Xuất các dòng đang hiển thị ra tệp CSV')).toBeDisabled(); // nothing to export yet
  g.release();
  await expect(dlg.locator('tbody tr')).toHaveCount(1);
  await expect(dlg.getByTitle('Xuất các dòng đang hiển thị ra tệp CSV')).toBeEnabled();
});

test('UW-DASH-107: while the health check runs the dialog shows no service list and no error; the services appear after the answer', async ({ page }) => {
  const dlg = page.getByRole('dialog', { name: 'Tình trạng hệ thống' });
  const g = await held(page, '/admin/system-health', HEALTH);
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg).toContainText('Đang kiểm tra…');
  await expect(dlg.getByRole('region', { name: 'Các thành phần' })).toHaveCount(0);
  await expect(dlg.getByRole('region', { name: 'Độ tươi dữ liệu' })).toHaveCount(0);
  await expect(dlg.getByRole('alert')).toHaveCount(0);
  g.release();
  await expect(dlg.getByRole('region', { name: 'Các thành phần' })).toContainText('Cơ sở dữ liệu');
  await expect(dlg).not.toContainText('Đang kiểm tra…');
});

test('UW-DASH-019: while a photo is loading the card shows no image, no placeholder text and no error; the photo appears when it arrives', async ({ page }) => {
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const report = { report_id: 11, status: 'submitted', longitude: 104.2, latitude: 21.9, description: 'Nứt đất 11', observed_at: '2026-10-10T03:00:00Z', image_url: '/api/v1/community-reports/11/image', submitter_name: 'Người báo 11', submitter_phone: null };
  await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? [report] : undefined));
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/community-reports/11/image', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    await gate;
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
  });
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Hiện trường' })).toHaveCount(0); // no broken <img> while waiting
  await expect(page.getByText('Không có ảnh')).toHaveCount(0); // a photo that is on its way is not "no photo"
  await expect(page.getByRole('alert')).toHaveCount(0);
  release();
  await expect(page.getByRole('img', { name: 'Hiện trường' })).toHaveAttribute('src', /^blob:/);
});
