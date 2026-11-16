import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Mocked API (admin). The history dialog reads GET /notifications/broadcasts, then the deliveries of the selected row,
// and can revoke a broadcast. Nothing here is ever sent: the fake server only answers reads and the revoke call.
// dialogs.spec.js only checks that the dialog opens and closes; broadcast.spec.js covers the send form.

const ID_A = 'aaaaaaaa-1111-4111-8111-000000000001';
const ID_B = 'bbbbbbbb-2222-4222-8222-000000000002';
const ID_C = 'cccccccc-3333-4333-8333-000000000003';
const ROWS = [
  { broadcastId: ID_A, sentAt: '2026-10-10T03:00:00Z', areaId: 1, areaName: 'Khu Mù Cang Chải', runId: 'run-a', recipients: 5, sent: 5, failed: 0, status: 'active', message: 'Sơ tán khẩn cấp khỏi sườn đồi', senderName: 'Quản trị An', severity: 'extreme' },
  { broadcastId: ID_B, sentAt: '2026-10-09T03:00:00Z', areaId: 2, areaName: 'Khu Văn Chấn', runId: 'run-b', recipients: 4, sent: 3, failed: 1, status: 'active', message: 'Theo dõi mưa lớn tối nay', senderName: 'Quản trị Bình', severity: 'high' },
  { broadcastId: ID_C, sentAt: '2026-10-08T03:00:00Z', areaId: 3, areaName: null, runId: 'run-c', recipients: 2, sent: 0, failed: 2, status: 'active', message: 'Thử nghiệm kênh phát', senderName: null, severity: 'high' }
];
const DELIVERIES = {
  [ID_A]: [
    { deliveryId: 'd1', recipientName: 'Nguyễn Văn Dũng', phoneNumber: '0912345678', status: 'sent' },
    { deliveryId: 'd2', recipientName: null, phoneNumber: null, status: 'failed', errorMessage: 'Token hết hạn' }
  ],
  [ID_B]: [{ deliveryId: 'd3', recipientName: 'Trần Thị Mai', phoneNumber: '0987654321', status: 'sent' }]
};

async function openHistory(page, { history = ROWS, deliveries = DELIVERIES, historyStatus = 200, revoke } = {}) {
  const calls = await mockBackend(page, 'admin', ({ method, path }) => {
    if (path === '/notifications/broadcasts') return [historyStatus, historyStatus === 200 ? history : { message: 'x' }];
    const d = path.match(/^\/notifications\/broadcast\/(.+)\/deliveries$/);
    if (d) return deliveries === 'error' ? [500, {}] : (deliveries[d[1]] ?? []);
    if (/\/revoke$/.test(path) && method === 'POST') return revoke ? revoke() : {};
  });
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await expect(page.getByRole('heading', { name: 'NHẬT KÝ ĐIỀU PHỐI & PHÁT CẢNH BÁO KHẨN CẤP' })).toBeVisible();
  return calls;
}
const entry = (page, code) => page.locator('div', { has: page.locator('code', { hasText: code }) }).last();

test('lists every broadcast with code, area, urgency and delivered count; first one is opened with its deliveries', async ({ page }) => {
  const calls = await openHistory(page);
  for (const [code, area, counts] of [['BC-aaaaaaaa', 'Khu Mù Cang Chải', '5/5 đã nhận'], ['BC-bbbbbbbb', 'Khu Văn Chấn', '3/4 đã nhận'], ['BC-cccccccc', 'Khu vực #3', '0/2 đã nhận']]) {
    await expect(page.locator('code', { hasText: code })).toBeVisible();
    await expect(page.getByText(area, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(counts, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('EXTREME', { exact: true })).toBeVisible();
  await expect(page.getByText('HIGH', { exact: true })).toHaveCount(2);

  // detail of the first row
  await expect(page.locator('h4')).toHaveText('Khu Mù Cang Chải');
  await expect(page.getByText('Sơ tán khẩn cấp khỏi sườn đồi')).toBeVisible();
  await expect(page.getByText('Quản trị An', { exact: true })).toBeVisible();
  await expect(page.getByText('ĐÃ GỬI', { exact: true })).toBeVisible();
  await expect(page.getByText('FCM', { exact: true })).toBeVisible();
  await expect(page.getByText('TỔNG NGƯỜI NHẬN').locator('..')).toContainText('5');
  await expect(page.getByText('2 thiết bị ghi nhận')).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Nguyễn Văn Dũng');
  await expect(rows.nth(0)).toContainText('0912345678');
  await expect(rows.nth(0)).toContainText('Thành công');
  await expect(rows.nth(1)).toContainText('Công dân'); // no name -> fallback
  await expect(rows.nth(1)).toContainText('—'); // no phone
  await expect(rows.nth(1)).toContainText('Thất bại');
  await expect(rows.nth(1)).toContainText('Token hết hạn');

  expect(calls.filter((c) => c.path === '/notifications/broadcasts').every((c) => c.method === 'GET')).toBe(true);
  expect(calls.filter((c) => /deliveries$/.test(c.path))).toEqual([{ method: 'GET', path: `/notifications/broadcast/${ID_A}/deliveries`, body: null }]);
  expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
});

test('selecting another row loads its deliveries and shows its own status', async ({ page }) => {
  const calls = await openHistory(page);
  await entry(page, 'BC-bbbbbbbb').click();
  await expect(page.locator('h4')).toHaveText('Khu Văn Chấn');
  await expect(page.getByText('GỬI MỘT PHẦN', { exact: true })).toBeVisible(); // 1 failed of 4
  await expect(page.getByText('Theo dõi mưa lớn tối nay')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByText('Trần Thị Mai')).toBeVisible();

  await entry(page, 'BC-cccccccc').click();
  await expect(page.locator('h4')).toHaveText('Khu vực #3');
  await expect(page.getByText('GỬI THẤT BẠI', { exact: true })).toBeVisible(); // nobody received it
  await expect(page.getByText('Không rõ', { exact: true })).toBeVisible(); // no sender name
  await expect(page.getByText('Chưa có dữ liệu chuyển phát chi tiết cho đợt phát này.')).toBeVisible();
  await expect(page.getByText('0 thiết bị ghi nhận')).toBeVisible();
  expect(calls.filter((c) => /deliveries$/.test(c.path)).map((c) => c.path))
    .toEqual([ID_A, ID_B, ID_C].map((id) => `/notifications/broadcast/${id}/deliveries`));
});

test('a failing deliveries call leaves the detail usable with the empty-deliveries text', async ({ page }) => {
  await openHistory(page, { deliveries: 'error' });
  await expect(page.locator('h4')).toHaveText('Khu Mù Cang Chải');
  await expect(page.getByText('Chưa có dữ liệu chuyển phát chi tiết cho đợt phát này.')).toBeVisible();
});

test('search narrows by area, code and message; no match shows the empty text and disables CSV', async ({ page }) => {
  await openHistory(page);
  const search = page.getByPlaceholder(/Tìm kiếm theo khu vực, mã lệnh/);
  await search.fill('văn chấn');
  await expect(page.locator('code')).toHaveCount(1);
  await expect(page.locator('code', { hasText: 'BC-bbbbbbbb' })).toBeVisible();
  await search.fill('BC-CCCC');
  await expect(page.locator('code')).toHaveCount(1);
  await expect(page.locator('code', { hasText: 'BC-cccccccc' })).toBeVisible();
  await search.fill('sơ tán');
  await expect(page.locator('code')).toHaveCount(1);
  await expect(page.locator('code', { hasText: 'BC-aaaaaaaa' })).toBeVisible();
  await search.fill('không-khớp-gì');
  await expect(page.getByText('Không tìm thấy đợt phát lệnh nào.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất CSV' })).toBeDisabled();
});

test('CSV export downloads only the rows currently shown', async ({ page }) => {
  await openHistory(page);
  await page.getByPlaceholder(/Tìm kiếm theo khu vực, mã lệnh/).fill('Văn Chấn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất CSV' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^terrawatch-lich-su-lenh-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
  expect(text).toContain('BC-bbbbbbbb');
  expect(text).toContain('Theo dõi mưa lớn tối nay');
  expect(text).not.toContain('BC-aaaaaaaa');
});

test('empty history: empty text, nothing selected, CSV disabled', async ({ page }) => {
  await openHistory(page, { history: [] });
  await expect(page.getByText('Không tìm thấy đợt phát lệnh nào.')).toBeVisible();
  await expect(page.getByText('Chọn một lệnh cảnh báo bên trái để xem chi tiết.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất CSV' })).toBeDisabled();
});

test('a 403 shows the admin-only message; Làm Mới retries and lists the rows once the server answers', async ({ page }) => {
  let status = 403;
  const calls = await mockBackend(page, 'admin', ({ path }) => {
    if (path === '/notifications/broadcasts') return status === 200 ? ROWS : [status, { message: 'x' }];
  });
  await page.goto('/');
  await openTool(page, 'Lịch sử lệnh');
  await expect(page.getByRole('alert')).toHaveText('Chỉ tài khoản Admin mới được phát lệnh và xem lịch sử phát lệnh.');
  await expect(page.locator('code')).toHaveCount(0);

  status = 200;
  const before = calls.filter((c) => c.path === '/notifications/broadcasts').length;
  await page.getByTitle('Làm mới danh sách').click(); // the sidebar has its own "Làm mới"
  await expect(page.locator('code')).toHaveCount(3);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(calls.filter((c) => c.path === '/notifications/broadcasts').length).toBe(before + 1);
});

test('a server error shows the generic load message with the cause', async ({ page }) => {
  await openHistory(page, { historyStatus: 500 });
  await expect(page.getByRole('alert')).toHaveText('Không tải được lịch sử phát lệnh (Request failed with status code 500).');
});

test('revoke needs a confirmation; Hủy sends nothing, confirming posts to /revoke and marks the row revoked', async ({ page }) => {
  const calls = await openHistory(page);
  await page.getByRole('button', { name: 'Thu Hồi Lệnh' }).click();
  await expect(page.getByText('Xác nhận thu hồi?')).toBeVisible();
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByText('Xác nhận thu hồi?')).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);

  await page.getByRole('button', { name: 'Thu Hồi Lệnh' }).click();
  await page.getByRole('button', { name: 'Đồng Ý Thu Hồi' }).click();
  await expect(page.getByText('ĐÃ THU HỒI', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thu Hồi Lệnh' })).toHaveCount(0);
  await expect(page.getByText('Xác nhận thu hồi?')).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([{ method: 'POST', path: `/notifications/broadcast/${ID_A}/revoke`, body: null }]);

  // the other rows are untouched
  await entry(page, 'BC-bbbbbbbb').click();
  await expect(page.getByRole('button', { name: 'Thu Hồi Lệnh' })).toBeVisible();
});

test('a failed revoke shows the server reason and keeps the broadcast revocable', async ({ page }) => {
  await openHistory(page, { revoke: () => [409, { message: 'x' }] });
  await page.getByRole('button', { name: 'Thu Hồi Lệnh' }).click();
  await page.getByRole('button', { name: 'Đồng Ý Thu Hồi' }).click();
  await expect(page.getByText(/^Lệnh bị từ chối: trùng mã đã xử lý/)).toBeVisible();
  await expect(page.getByText('ĐÃ GỬI', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đồng Ý Thu Hồi' })).toBeEnabled(); // can try again
});

test('"Phát Lệnh Mới" closes the history and opens the send form without sending anything', async ({ page }) => {
  const calls = await openHistory(page);
  await page.getByRole('button', { name: 'Phát Lệnh Mới' }).click();
  await expect(page.getByRole('heading', { name: 'NHẬT KÝ ĐIỀU PHỐI & PHÁT CẢNH BÁO KHẨN CẤP' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('PHÁT LỆNH CẢNH BÁO THIÊN TAI KHẨN CẤP');
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});
