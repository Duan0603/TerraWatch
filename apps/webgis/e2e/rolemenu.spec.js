import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. Which top-bar menu entries each role gets (UW-DASH-120..149): the nine tools of the matrix are the five items of
// "Công cụ" plus the four of "Quản trị", and "Phát cảnh báo" is the tenth control. navbar.spec.js and dialogs.spec.js only count
// the items or open some of them; here every entry is checked by name and hint, per role, and the absent ones are checked to be absent.
// MS-SRS-068 (CSV: a popup "Chỉ tài khoản Admin…" when a non-admin selects Broadcast) is out of date: the app disables the button
// and puts the sentence in its title, see navbar.spec.js.

const TOOLS = [
  ['Xuất báo cáo', 'Hàng đợi dự báo hiện tại ra tệp CSV (mở được bằng Excel)'],
  ['Lịch sử lệnh', 'Nhật ký phát lệnh cảnh báo SMS / FCM'],
  ['Nhật ký thẩm định', 'Ai duyệt dự báo, lý do'],
  ['Báo cáo hiện trường', 'Báo cáo và hình ảnh từ người dân'],
  ['Thẻ mô hình', 'Mô hình AI là gì, đã kiểm tra thế nào, giới hạn ra sao']
];
const ADMIN_TOOLS = [
  ['Vùng giám sát', 'Ranh giới các vùng theo dõi sạt lở'],
  ['Quản trị người dùng', 'Phân quyền, khóa tài khoản, duyệt cán bộ'],
  ['Nhật ký quản trị', 'Ai đã khóa, đổi quyền, phát hoặc thu hồi cảnh báo'],
  ['Tình trạng hệ thống', 'Dịch vụ đang chạy và độ tươi của dữ liệu']
];
const QUEUE = [forecastItem('run-1', 'Mù Cang Chải - E2E', 'high')];

async function openAs(page, role) {
  const calls = await mockBackend(page, role, ({ path }) => (path === '/forecasts/review-queue' ? QUEUE : undefined));
  await page.goto('/');
  return calls;
}

test('citizen (UW-DASH-120..129): no Công cụ, no Quản trị, no Phát cảnh báo, and no staff endpoint is requested', async ({ page }) => {
  const calls = await openAs(page, 'citizen');
  await expect(page.getByText('Cảnh báo sạt lở cho người dân')).toBeVisible();
  for (const name of ['Công cụ', 'Quản trị', 'Phát cảnh báo']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  // none of the nine tools has a way in, and none of their endpoints is asked for
  await expect(page.getByRole('button', { name: /Xuất báo cáo|Lịch sử lệnh|Nhật ký thẩm định|Báo cáo hiện trường|Thẻ mô hình|Vùng giám sát|Quản trị người dùng|Nhật ký quản trị|Tình trạng hệ thống/ })).toHaveCount(0);
  expect(calls.filter((c) => /review-queue|^\/admin|model-card|community-reports|notifications|reviews/.test(c.path))).toEqual([]);
});

test('officer (UW-DASH-130..139): the five tools with their hints; no Quản trị menu, no admin entry anywhere; Phát cảnh báo disabled', async ({ page }) => {
  await openAs(page, 'officer');
  await expect(page.locator('.event-card')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Công cụ' }).click();
  const items = page.getByRole('menuitem');
  await expect(items).toHaveCount(TOOLS.length);
  for (const [i, [label, hint]] of TOOLS.entries()) {
    await expect(items.nth(i)).toHaveText(label + hint);
  }
  await expect(page.getByRole('button', { name: 'Quản trị' })).toHaveCount(0);
  for (const [label] of ADMIN_TOOLS) await expect(page.getByRole('menuitem', { name: new RegExp(label) })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toBeDisabled();
});

test('admin (UW-DASH-140..149): the five tools and the four admin tools, each with its hint; Phát cảnh báo enabled', async ({ page }) => {
  await openAs(page, 'admin');
  await expect(page.locator('.event-card')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Công cụ' }).click();
  const tools = page.getByRole('menuitem');
  await expect(tools).toHaveCount(TOOLS.length);
  for (const [i, [label, hint]] of TOOLS.entries()) await expect(tools.nth(i)).toHaveText(label + hint);

  await page.getByRole('button', { name: 'Quản trị' }).click(); // the other menu closes first
  await expect(page.getByRole('menuitem')).toHaveCount(ADMIN_TOOLS.length);
  for (const [i, [label, hint]] of ADMIN_TOOLS.entries()) await expect(page.getByRole('menuitem').nth(i)).toHaveText(label + hint);
  await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toBeEnabled();
});
