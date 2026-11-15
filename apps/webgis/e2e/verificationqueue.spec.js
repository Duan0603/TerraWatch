import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. review.spec.js covers the happy path of approving/rejecting one proposal. This file covers the queue itself
// (tabs, counts, search, expired / unavailable cards, refresh, export) and the review dialog's cancel and server-error paths.

const past = () => new Date(Date.now() - 3600e3).toISOString();
const ITEMS = () => [
  forecastItem('run-p1', 'Mù Cang Chải - E2E', 'high'),
  forecastItem('run-p2', 'Văn Chấn - E2E', 'medium'),
  forecastItem('run-a1', 'Trạm Tấu - E2E', 'low', { reviewStatus: 'approved' }),
  forecastItem('run-r1', 'Sa Pa - E2E', 'extreme', { reviewStatus: 'rejected' }),
  forecastItem('run-x1', 'Hết Hạn - E2E', 'high', { expired: true, validUntil: past() }),
  forecastItem('run-u1', 'Thiếu Dữ Liệu - E2E', 'high', { availability: 'unavailable', unavailabilityReason: 'SNAPSHOT_MISSING', hazardLevel: null, probability: null }),
  forecastItem('run-s1', 'Đã Thay Thế - E2E', 'medium', { reviewStatus: 'superseded' })
];

async function openQueue(page, handler) {
  const items = ITEMS();
  const urls = [];
  page.on('request', (r) => { if (r.url().includes('/forecasts/review-queue')) urls.push(new URL(r.url())); });
  const calls = await mockBackend(page, 'officer', (c) => handler?.(c, items) ?? (c.path === '/forecasts/review-queue' ? items : undefined));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Chờ duyệt \(3\)/ })).toBeVisible(); // p1, p2 and the one without a forecast; the expired one is not counted
  return { calls, items, urls, card: (name) => page.locator('.event-card', { hasText: name }) };
}
const tab = (page, re) => page.getByRole('button', { name: re });

test('loads the queue with status=all and counts each tab; pending shows only live pending proposals', async ({ page }) => {
  const { urls, card } = await openQueue(page);
  expect(urls[0].searchParams.get('status')).toBe('all');
  await expect(tab(page, /Đã duyệt \(1\)/)).toBeVisible();
  await expect(tab(page, /Từ chối \(1\)/)).toBeVisible();
  await expect(tab(page, /Tất cả \(7\)/)).toBeVisible();

  // pending tab: live pending proposals only (the expired one is left out; one without a forecast is still pending)
  await expect(page.locator('.event-card')).toHaveCount(3);
  await expect(card('Hết Hạn - E2E')).toHaveCount(0);
  await expect(card('Mù Cang Chải - E2E')).toBeVisible();
});

test('each tab filters the list; all lists every state with its status label', async ({ page }) => {
  const { card } = await openQueue(page);
  await tab(page, /Đã duyệt/).click();
  await expect(page.locator('.event-card')).toHaveCount(1);
  await expect(card('Trạm Tấu - E2E').locator('.event-status')).toContainText('Đã phê duyệt');
  await tab(page, /Từ chối/).click();
  await expect(page.locator('.event-card')).toHaveCount(1);
  await expect(card('Sa Pa - E2E').locator('.event-status')).toContainText('Đã từ chối');
  await tab(page, /Tất cả/).click();
  await expect(page.locator('.event-card')).toHaveCount(7);
  await expect(card('Đã Thay Thế - E2E').locator('.event-status')).toContainText('Đã bị thay thế');
  await expect(card('Mù Cang Chải - E2E').locator('.event-status')).toContainText('Chờ thẩm định');
});

test('an expired proposal says so, with no review buttons; a proposal without a forecast gives the reason', async ({ page }) => {
  const { card } = await openQueue(page);
  await tab(page, /Tất cả/).click();
  const expired = card('Hết Hạn - E2E');
  await expect(expired).toContainText('Đã hết hạn');
  await expect(expired.getByRole('button')).toHaveCount(0);

  const none = card('Thiếu Dữ Liệu - E2E');
  await expect(none).toContainText('Không có dự báo');
  await expect(none).toContainText('Chưa có bộ đặc trưng đầu vào (snapshot) cho lần chạy này');
  await expect(none.getByRole('button')).toHaveCount(0); // cannot be reviewed without a forecast

  const live = card('Mù Cang Chải - E2E');
  await expect(live).toContainText('Hiệu lực');
  await expect(live).toContainText('Điểm thử nghiệm: 62%');
  await expect(live.getByRole('button', { name: 'Phê duyệt' })).toBeVisible();
  await expect(card('Trạm Tấu - E2E').getByRole('button')).toHaveCount(0); // already decided
});

test('search filters by area name in every tab and shows the empty text when nothing matches', async ({ page }) => {
  const { card } = await openQueue(page);
  await page.getByPlaceholder('Tìm khu vực...').fill('  văn chấn ');
  await expect(page.locator('.event-card')).toHaveCount(1);
  await expect(card('Văn Chấn - E2E')).toBeVisible();
  await page.getByPlaceholder('Tìm khu vực...').fill('không-có-khu-vực-này');
  await expect(page.getByText('Không có đề xuất cảnh báo trong bộ lọc này.')).toBeVisible();
  await tab(page, /Tất cả/).click();
  await expect(page.getByText('Không có đề xuất cảnh báo trong bộ lọc này.')).toBeVisible();
  await page.getByPlaceholder('Tìm khu vực...').fill('Sa Pa');
  await expect(page.locator('.event-card')).toHaveCount(1);
});

test('clicking a card selects it; the first card is selected on load', async ({ page }) => {
  const { card } = await openQueue(page);
  await expect(card('Mù Cang Chải - E2E')).toHaveClass(/selected/);
  await card('Văn Chấn - E2E').click();
  await expect(card('Văn Chấn - E2E')).toHaveClass(/selected/);
  await expect(card('Mù Cang Chải - E2E')).not.toHaveClass(/selected/);
});

test('the Làm mới button in the queue asks the server again and shows the new proposal', async ({ page }) => {
  const { calls, items } = await openQueue(page);
  const before = calls.filter((c) => c.path === '/forecasts/review-queue').length;
  items.push(forecastItem('run-new', 'Mới Về - E2E', 'high'));
  await page.locator('.sidebar-footer').getByRole('button', { name: 'Làm mới' }).click();
  await expect(tab(page, /Chờ duyệt \(4\)/)).toBeVisible();
  await expect(page.locator('.event-card', { hasText: 'Mới Về - E2E' })).toBeVisible();
  expect(calls.filter((c) => c.path === '/forecasts/review-queue').length).toBeGreaterThan(before);
});

test('a failed queue load shows the banner with the status message and Thử lại recovers', async ({ page }) => {
  let fail = true;
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/forecasts/review-queue') return fail ? [403, { message: 'x' }] : [forecastItem('run-ok', 'Hồi Phục - E2E', 'medium')];
  });
  await page.goto('/');
  await expect(page.getByRole('alert').first()).toContainText('Tài khoản không có quyền thẩm định dự báo.');
  await expect(page.getByText('Mất kết nối API')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.locator('.event-card', { hasText: 'Hồi Phục - E2E' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('review dialog: Hủy closes it and sends nothing; the title and area follow the decision', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await card('Văn Chấn - E2E').getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(page.getByText('Phê duyệt đề xuất cảnh báo')).toBeVisible();
  await expect(page.getByText(/Văn Chấn - E2E — việc duyệt chỉ xác nhận đề xuất cảnh báo hợp lệ/)).toBeVisible();
  await page.getByRole('button', { name: 'Hủy' }).click();
  await expect(page.getByText('Phê duyệt đề xuất cảnh báo')).toHaveCount(0);

  await card('Văn Chấn - E2E').getByRole('button', { name: 'Từ chối' }).click();
  await expect(page.getByText('Từ chối đề xuất cảnh báo')).toBeVisible();
  await page.getByPlaceholder('Lý do từ chối (bắt buộc)').fill('   '); // blank is still no reason
  await expect(page.getByRole('button', { name: 'Xác nhận từ chối' })).toBeDisabled();
  await page.getByRole('button', { name: 'Hủy' }).click();
  expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
});

test('a 409 on approve shows the server-state message inside the dialog and reloads the queue', async ({ page }) => {
  const { calls, card } = await openQueue(page, ({ method, path }, items) => {
    if (method === 'PATCH') return [409, { message: 'x' }];
    if (path === '/forecasts/review-queue') return items;
  });
  const before = calls.filter((c) => c.path === '/forecasts/review-queue').length;
  await card('Văn Chấn - E2E').getByRole('button', { name: 'Phê duyệt' }).click();
  await page.getByRole('button', { name: 'Xác nhận phê duyệt' }).click();
  await expect(page.getByText('Dự báo đã được xử lý, đã hết hạn hoặc đã bị thay thế bởi bản mới. Hãy tải lại danh sách.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận phê duyệt' })).toBeEnabled(); // not stuck on "Đang gửi..."
  await expect.poll(() => calls.filter((c) => c.path === '/forecasts/review-queue').length).toBeGreaterThan(before);
  expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
});

test('"Xuất báo cáo" downloads the whole queue as CSV, with Vietnamese labels', async ({ page }) => {
  await openQueue(page);
  await page.getByRole('button', { name: 'Công cụ' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Xuất báo cáo' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^terrawatch-du-bao-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
  expect(text).toContain('Trạng thái thẩm định');
  expect(text).toContain('Mù Cang Chải - E2E');
  expect(text).toContain('Chờ thẩm định');
  expect(text).toContain('Đã phê duyệt');
  expect(text).toContain('Đã bị thay thế');
  expect(text.trim().split(/\r?\n/)).toHaveLength(8); // header + 7 rows
});
