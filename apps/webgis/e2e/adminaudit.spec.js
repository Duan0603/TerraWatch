import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool } from './helpers.js';

// Mocked API (admin). The "Nhật ký quản trị" dialog reads GET /admin/audit?limit=300. Read-only, nothing is written.
// reviewaudit.spec.js is the forecast-review log; this is the separate log of admin actions.

const LOG = [
  { id: 1, at: '2026-10-10T03:00:00Z', actor: 'admin@e2e.test', action: 'USER_LOCK', targetLabel: 'Cán Bộ Một', targetId: 'u-1', detail: '' },
  { id: 2, at: '2026-10-10T04:00:00Z', actor: 'admin@e2e.test', action: 'USER_ROLE', targetLabel: 'Cán Bộ Hai', targetId: 'u-2', detail: 'role=officer' },
  { id: 3, at: '2026-10-10T05:00:00Z', actor: 'admin@e2e.test', action: 'BROADCAST_SEND', targetLabel: null, targetId: 'bc-3', detail: 'status=PARTIAL' },
  { id: 4, at: '2026-10-10T06:00:00Z', actor: null, action: 'BROADCAST_REVOKE', targetLabel: 'Khu E2E', targetId: 'bc-4', detail: 'lý do thử' },
  { id: 5, at: '2026-10-10T07:00:00Z', actor: 'admin@e2e.test', action: 'MYSTERY_CODE', targetLabel: null, targetId: null, detail: 'status=NO_RECIPIENTS' }
];

async function openLog(page, { log = LOG, status = 200 } = {}) {
  const calls = await mockBackend(page, 'admin', ({ path }) => {
    if (path === '/admin/audit') return [status, status === 200 ? log : { message: 'Máy chủ từ chối: cần quyền Admin.' }];
  });
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(page.getByRole('dialog', { name: 'Nhật ký quản trị' })).toBeVisible();
  return calls;
}
const dlg = (page) => page.getByRole('dialog', { name: 'Nhật ký quản trị' });
// The text labels (.btn-label) are hidden below 1280 px, so these buttons are found by their title.
const csv = (page) => dlg(page).getByTitle('Xuất các dòng đang hiển thị ra tệp CSV');
const filter = (page) => page.getByLabel('Lọc theo thao tác');

test('asks for the latest 300 rows and shows each action with a readable label, target and detail', async ({ page }) => {
  const calls = await openLog(page);
  const rows = dlg(page).locator('tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(dlg(page)).toContainText('5 dòng');

  await expect(rows.nth(0)).toContainText('Khóa tài khoản');
  await expect(rows.nth(0)).toContainText('Cán Bộ Một');
  await expect(rows.nth(0)).toContainText('admin@e2e.test');
  await expect(rows.nth(0)).toContainText('(UTC+7)'); // times are shown in Vietnam time
  await expect(rows.nth(1)).toContainText('Đổi vai trò');
  await expect(rows.nth(1)).toContainText('Vai trò mới: Cán bộ');
  await expect(rows.nth(2)).toContainText('Phát cảnh báo');
  await expect(rows.nth(2)).toContainText('bc-3'); // no label -> target id
  await expect(rows.nth(2)).toContainText('Kết quả: gửi được một phần');
  await expect(rows.nth(3)).toContainText('Thu hồi cảnh báo');
  await expect(rows.nth(3)).toContainText('—'); // no actor
  await expect(rows.nth(3)).toContainText('lý do thử');
  await expect(rows.nth(4)).toContainText('MYSTERY_CODE'); // unknown code shown as is
  await expect(rows.nth(4)).toContainText('status=NO_RECIPIENTS');

  expect(calls.filter((c) => c.path === '/admin/audit')).toEqual([{ method: 'GET', path: '/admin/audit', body: null }]);
  const url = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/admin/audit')));
  expect(new URL(url).searchParams.get('limit')).toBe('300');
});

test('the action filter lists every known action and narrows the rows and the count', async ({ page }) => {
  await openLog(page);
  const labels = await filter(page).locator('option').allTextContents();
  expect(labels).toEqual(['Mọi thao tác', 'Khóa tài khoản', 'Mở khóa tài khoản', 'Đổi vai trò', 'Duyệt cán bộ', 'Từ chối cán bộ', 'Phát cảnh báo', 'Thu hồi cảnh báo']);

  await filter(page).selectOption('USER_ROLE');
  await expect(dlg(page).locator('tbody tr')).toHaveCount(1);
  await expect(dlg(page)).toContainText('1 dòng');
  await expect(dlg(page).locator('tbody')).toContainText('Cán Bộ Hai');

  await filter(page).selectOption('OFFICER_APPROVE'); // known action, no rows
  await expect(dlg(page).getByText('Chưa có thao tác nào được ghi lại.')).toBeVisible();
  await expect(csv(page)).toBeDisabled();

  await filter(page).selectOption('ALL');
  await expect(dlg(page).locator('tbody tr')).toHaveCount(5);
});

test('empty log shows the empty state and disables CSV', async ({ page }) => {
  await openLog(page, { log: [] });
  await expect(dlg(page).getByText('Chưa có thao tác nào được ghi lại.')).toBeVisible();
  await expect(csv(page)).toBeDisabled();
  await expect(dlg(page).locator('table')).toHaveCount(0);
});

test('a rejected call shows the server message, no table and no empty-state text', async ({ page }) => {
  await openLog(page, { status: 403 });
  await expect(dlg(page).getByRole('alert')).toContainText('Máy chủ từ chối: cần quyền Admin.');
  await expect(dlg(page).getByText('Chưa có thao tác nào được ghi lại.')).toHaveCount(0);
  await expect(dlg(page).locator('table')).toHaveCount(0);
});

test('Làm mới reloads the log', async ({ page }) => {
  let log = LOG.slice(0, 2);
  const calls = await mockBackend(page, 'admin', ({ path }) => (path === '/admin/audit' ? log : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(dlg(page).locator('tbody tr')).toHaveCount(2);
  log = LOG;
  await dlg(page).getByTitle('Tải lại').click();
  await expect(dlg(page).locator('tbody tr')).toHaveCount(5);
  expect(calls.filter((c) => c.path === '/admin/audit')).toHaveLength(2);
});

test('CSV export downloads the rows currently shown, with the readable labels', async ({ page }) => {
  await openLog(page);
  await filter(page).selectOption('USER_LOCK');
  const [download] = await Promise.all([page.waitForEvent('download'), csv(page).click()]);
  expect(download.suggestedFilename()).toMatch(/^terrawatch-nhat-ky-quan-tri-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
  expect(text).toContain('Thao tác');
  expect(text).toContain('Khóa tài khoản');
  expect(text).toContain('Cán Bộ Một');
  expect(text).not.toContain('Cán Bộ Hai');
});

test('the close button and a click on the backdrop close it, a click inside does not', async ({ page }) => {
  await openLog(page);
  await dlg(page).getByText('Nhật ký thao tác quản trị').click();
  await expect(dlg(page)).toBeVisible();
  await dlg(page).getByRole('button', { name: 'Đóng' }).click();
  await expect(dlg(page)).toHaveCount(0);

  await openAdminTool(page, 'Nhật ký quản trị');
  await expect(dlg(page)).toBeVisible();
  await page.mouse.click(4, 4); // backdrop corner
  await expect(dlg(page)).toHaveCount(0);
});

test('an officer has no "Quản trị" menu, so the admin log is not reachable and /admin/audit is never called', async ({ page }) => {
  const calls = await mockBackend(page, 'officer', () => undefined);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Công cụ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quản trị' })).toHaveCount(0);
  expect(calls.filter((c) => c.path.startsWith('/admin'))).toEqual([]);
});
