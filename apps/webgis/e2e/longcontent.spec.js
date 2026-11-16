import { test, expect } from '@playwright/test';
import { mockBackend, openTool, openAdminTool, forecastItem } from './helpers.js';

// Mocked API. "Very long content" conditions of the P2 list (a 100-character name without spaces, 500 rows): the screen must cut or scroll the content
// in a controlled way. Checked per screen: the dialog box stays inside the window (its close button can still be reached), the page gets no
// sideways scroll, and the list scrolls inside the dialog instead of growing the dialog. UW-AUD-014, UW-USR-014, UW-RPT-014, UW-FREV-021,
// UW-BRD-014 (dialogs with 500 rows) and UW-DASH-039 (proposal card with a 100-character place name).

const LONG = 'X'.repeat(100);
const N = 500;
const rows = (make) => Array.from({ length: N }, (_, i) => make(i + 1));
const audit = (i) => ({ id: i, at: '2026-10-10T03:00:00Z', actor: `${LONG}@e2e.test`, action: 'USER_LOCK', targetLabel: `${LONG}-${i}`, targetId: `u-${i}`, detail: '' });
const user = (i) => ({ userId: `u-${i}`, fullName: `${LONG}${i}`, email: `${LONG}${i}@e2e.test`, role: 'citizen', isActive: true, approvalStatus: 'approved', phoneNumber: null });
const report = (i) => ({ report_id: i, status: 'submitted', longitude: 104.2, latitude: 21.9, description: `${LONG} ${i}`, observed_at: '2026-10-10T03:00:00Z', image_url: null, submitter_name: `${LONG}${i}`, submitter_phone: null });
const review = (i) => ({ reviewId: i, runId: `run-${i}`, unitId: `${LONG}${i}`, hazardLevel: 'high', decision: 'approved', reviewerName: `${LONG}${i}`, reviewerEmail: 'an@e2e.test', reviewerRole: 'officer', reasonNotes: LONG, reviewedAt: '2026-10-10T03:00:00Z' });
const bc = (i) => ({ broadcastId: `aaaaaaaa-1111-4111-8111-${String(i).padStart(12, '0')}`, sentAt: '2026-10-10T03:00:00Z', areaId: i, areaName: `${LONG}${i}`, runId: `run-${i}`, recipients: 1, sent: 1, failed: 0, status: 'active', message: LONG, senderName: LONG, severity: 'high' });

const SCREENS = [
  { id: 'UW-AUD-014', name: 'admin log', role: 'admin', path: '/admin/audit', data: rows(audit), open: (p) => openAdminTool(p, 'Nhật ký quản trị'), dialog: (p) => p.getByRole('dialog', { name: 'Nhật ký quản trị' }), close: (d) => d.getByRole('button', { name: 'Đóng' }), scroller: (d) => d.locator('div').filter({ has: d.locator('table') }).last() },
  { id: 'UW-USR-014', name: 'user management', role: 'admin', path: '/admin/users', data: rows(user), open: (p) => openAdminTool(p, 'Quản trị người dùng'), dialog: (p) => p.getByRole('heading', { name: /Quản Trị Người Dùng/ }).locator('xpath=ancestor::div[contains(@style,"90vh")][1]'), close: (d) => d.locator('svg.lucide-x').first().locator('xpath=ancestor::button'), scroller: (d) => d.locator('div').filter({ has: d.locator('table') }).last() },
  { id: 'UW-RPT-014', name: 'field reports', role: 'officer', path: '/community-reports', data: rows(report), open: (p) => openTool(p, 'Báo cáo hiện trường'), dialog: (p) => p.getByRole('heading', { name: 'BÁO CÁO HIỆN TRƯỜNG TỪ CỘNG ĐỒNG' }).locator('xpath=ancestor::div[contains(@style,"90vh")][1]'), close: (d) => d.locator('svg.lucide-x').first().locator('xpath=ancestor::button') },
  { id: 'UW-FREV-021', name: 'review log', role: 'officer', path: '/forecasts/reviews/audit', data: rows(review), open: (p) => openTool(p, 'Nhật ký thẩm định'), dialog: (p) => p.getByRole('heading', { name: 'NHẬT KÝ THẨM ĐỊNH DỰ BÁO' }).locator('xpath=ancestor::div[contains(@style,"90vh")][1]'), close: (d) => d.locator('svg.lucide-x').first().locator('xpath=ancestor::button') },
  { id: 'UW-BRD-014', name: 'broadcast history', role: 'admin', path: '/notifications/broadcasts', data: rows(bc), open: (p) => openTool(p, 'Lịch sử lệnh'), dialog: (p) => p.getByRole('heading', { name: 'NHẬT KÝ ĐIỀU PHỐI & PHÁT CẢNH BÁO KHẨN CẤP' }).locator('xpath=ancestor::div[contains(@style,"90vh")][1]'), close: (d) => d.locator('svg.lucide-x').first().locator('xpath=ancestor::button') }
];

for (const s of SCREENS) {
  test(`${s.id}: ${N} rows with 100-character names: the ${s.name} dialog stays inside the window, its close button is reachable, the page does not scroll sideways`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mockBackend(page, s.role, ({ path }) => (path === s.path ? s.data : (path === '/forecasts/reviews/metrics' ? [404, {}] : undefined)));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Công cụ' })).toBeVisible();
    await s.open(page);
    const d = s.dialog(page);
    await expect(d).toBeVisible();
    await expect(d.getByText(LONG, { exact: false }).first()).toBeVisible(); // the long text is rendered (which of the 500 comes first depends on the sort)
    const win = page.viewportSize();
    const box = await d.boundingBox();
    expect(box.height, 'the dialog grew past the window height').toBeLessThanOrEqual(win.height);
    expect(box.x, 'dialog starts left of the window').toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, 'dialog ends right of the window').toBeLessThanOrEqual(win.width + 1);
    const close = await s.close(d).first().boundingBox();
    expect(close.y >= 0 && close.y + close.height <= win.height && close.x >= 0 && close.x + close.width <= win.width, `close button outside the window: ${JSON.stringify(close)}`).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // the 500 rows are reached by scrolling inside the dialog, not by a taller dialog
    expect(await d.evaluate((el) => [el, ...el.querySelectorAll('div')].some((n) => n.scrollHeight > n.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(n).overflowY)))).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('UW-DASH-039: a 100-character place name in a proposal card is cut or wrapped inside the card; the card keeps its buttons and the list its width', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/review-queue' ? [forecastItem('run-1', LONG, 'high'), forecastItem('run-2', 'Văn Chấn - E2E', 'medium')] : (path === '/forecasts/reviews/metrics' ? [404, {}] : undefined)));
  await page.goto('/');
  const card = page.locator('.event-card', { hasText: LONG });
  await expect(card).toBeVisible();
  const sidebar = await page.locator('.sidebar').boundingBox();
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(sidebar.x - 1);
  expect(box.x + box.width, 'the card is wider than the list').toBeLessThanOrEqual(sidebar.x + sidebar.width + 1);
  await expect(card.getByRole('button', { name: 'Phê duyệt' })).toBeVisible();
  const btn = await card.getByRole('button', { name: 'Từ chối' }).boundingBox();
  expect(btn.x + btn.width).toBeLessThanOrEqual(sidebar.x + sidebar.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
