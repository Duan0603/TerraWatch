import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool } from './helpers.js';

// Mocked API (admin). "Tình trạng hệ thống" reads GET /admin/system-health: services and how old the newest data is.

const ago = (mins) => new Date(Date.now() - mins * 60e3).toISOString();
const HEALTH = () => ({
  checkedAt: '2026-10-10T03:00:00Z',
  components: [
    { key: 'db', label: 'Cơ sở dữ liệu', status: 'ok', latencyMs: 12, detail: 'ok' },
    { key: 'redis', label: 'Bộ nhớ đệm Redis', status: 'degraded', latencyMs: 480, detail: 'Chậm bất thường' },
    { key: 'ai', label: 'Dịch vụ AI', status: 'down', latencyMs: 3000, detail: 'Hết thời gian chờ' }
  ],
  freshness: [
    { key: 'rain', label: 'Mưa theo giờ', latest: ago(5), ageMinutes: 5 },
    { key: 'forecast', label: 'Dự báo', latest: ago(8 * 60), ageMinutes: 8 * 60 },
    { key: 'gis', label: 'Lớp GIS', latest: ago(3 * 24 * 60), ageMinutes: 3 * 24 * 60 },
    { key: 'landslide', label: 'Sạt lở đã xác nhận', latest: null, ageMinutes: null }
  ]
});

async function openHealth(page, { data = HEALTH, status = 200 } = {}) {
  const calls = await mockBackend(page, 'admin', ({ path }) => {
    if (path === '/admin/system-health') return [status, status === 200 ? data() : { message: 'Máy chủ không trả lời tình trạng.' }];
  });
  await page.goto('/');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg(page)).toBeVisible();
  return calls;
}
// one row of a section (the rows are the direct children of the grid)
const item = (sec, label) => sec.locator('> div > div').filter({ hasText: label });
const dlg = (page) => page.getByRole('dialog', { name: 'Tình trạng hệ thống' });

test('shows each service with a status label, latency and detail', async ({ page }) => {
  const calls = await openHealth(page);
  const sec = dlg(page).getByRole('region', { name: 'Các thành phần' });
  await expect(sec.locator('> div > div')).toHaveCount(3);
  const db = item(sec, 'Cơ sở dữ liệu');
  await expect(db).toContainText('Hoạt động');
  await expect(db).toContainText('Phản hồi bình thường'); // ok replaces the raw detail
  await expect(db).toContainText('12 ms');
  const redis = item(sec, 'Bộ nhớ đệm Redis');
  await expect(redis).toContainText('Chạy nhưng chưa đủ');
  await expect(redis).toContainText('Chậm bất thường');
  await expect(redis).toContainText('480 ms');
  const ai = item(sec, 'Dịch vụ AI');
  await expect(ai).toContainText('Mất kết nối');
  await expect(ai).toContainText('Hết thời gian chờ');
  await expect(dlg(page)).toContainText('Kiểm tra lúc');
  await expect(dlg(page)).toContainText('(UTC+7)');
  expect(calls.filter((c) => c.path === '/admin/system-health')).toEqual([{ method: 'GET', path: '/admin/system-health', body: null }]);
});

test('data freshness shows the age as text and colours it: <6 h ok, <24 h warning, older or missing bad', async ({ page }) => {
  await openHealth(page);
  const sec = dlg(page).getByRole('region', { name: 'Độ tươi dữ liệu' });
  const age = (label) => item(sec, label);
  await expect(age('Mưa theo giờ')).toContainText('5 phút trước');
  await expect(age('Dự báo')).toContainText('8 giờ trước');
  await expect(age('Lớp GIS')).toContainText('3 ngày trước');
  await expect(age('Sạt lở đã xác nhận')).toContainText('Chưa có bản ghi nào');
  await expect(age('Sạt lở đã xác nhận')).toContainText('Chưa có dữ liệu');

  const colour = (label) => age(label).locator('> div').last().evaluate((el) => getComputedStyle(el).color);
  expect(await colour('Mưa theo giờ')).toBe('rgb(52, 211, 153)');
  expect(await colour('Dự báo')).toBe('rgb(251, 191, 36)');
  expect(await colour('Lớp GIS')).toBe('rgb(248, 113, 113)');
  expect(await colour('Sạt lở đã xác nhận')).toBe('rgb(248, 113, 113)');
  await expect(sec).toContainText('Màu vàng khi dữ liệu cũ hơn 6 giờ, đỏ khi cũ hơn 24 giờ hoặc chưa có dữ liệu.');
});

test('Làm mới asks again and shows the new answer', async ({ page }) => {
  let down = true;
  const calls = await mockBackend(page, 'admin', ({ path }) => {
    if (path !== '/admin/system-health') return undefined;
    const h = HEALTH();
    if (!down) h.components[2] = { key: 'ai', label: 'Dịch vụ AI', status: 'ok', latencyMs: 90, detail: 'ok' };
    return h;
  });
  await page.goto('/');
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg(page)).toContainText('Mất kết nối');
  down = false;
  await dlg(page).getByTitle('Kiểm tra lại').click();
  await expect(dlg(page)).not.toContainText('Mất kết nối');
  await expect(dlg(page)).toContainText('90 ms');
  expect(calls.filter((c) => c.path === '/admin/system-health')).toHaveLength(2);
});

test('a failed call shows the server message and no service list', async ({ page }) => {
  await openHealth(page, { status: 500 });
  await expect(dlg(page).getByRole('alert')).toContainText('Máy chủ không trả lời tình trạng.');
  await expect(dlg(page).getByRole('region', { name: 'Các thành phần' })).toHaveCount(0);
  await expect(dlg(page)).toContainText('Đang kiểm tra…'); // no "checked at" time without an answer
});

test('the close button and a click on the backdrop close it', async ({ page }) => {
  await openHealth(page);
  await dlg(page).getByRole('button', { name: 'Đóng' }).click();
  await expect(dlg(page)).toHaveCount(0);
  await openAdminTool(page, 'Tình trạng hệ thống');
  await expect(dlg(page)).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(dlg(page)).toHaveCount(0);
});
