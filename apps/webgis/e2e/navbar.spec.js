import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. Top bar (Navbar, NavMenu) and the mobile tab bar. dialogs.spec.js already checks that the tool menu lists 5 items
// at 1440 px, that every tool opens its dialog and that Escape closes a menu; maplayout.spec.js checks the card/button overlap.
// Here: who sees what, the connection chip, the menus' keyboard and mouse behaviour, sound, logout and the mobile tabs.

const QUEUE = [forecastItem('run-1', 'Mù Cang Chải - E2E', 'high'), forecastItem('run-2', 'Văn Chấn - E2E', 'medium')];
const open = async (page, role, handler) => {
  const calls = await mockBackend(page, role, (c) => handler?.(c) ?? (c.path === '/forecasts/review-queue' ? QUEUE : undefined));
  await page.goto('/');
  await expect(page.locator('.event-card')).not.toHaveCount(0);
  return calls;
};

test('officer: name, initials and role label; the broadcast button is disabled with the reason; no admin menu', async ({ page }) => {
  await open(page, 'officer');
  await expect(page.locator('.nav-user-name')).toHaveText('E2E officer');
  await expect(page.locator('.nav-avatar')).toHaveText('EO');
  await expect(page.locator('.nav-user-role')).toHaveText('Cán bộ giám sát');
  const send = page.getByRole('button', { name: 'Phát cảnh báo' });
  await expect(send).toBeDisabled();
  await expect(send).toHaveAttribute('title', 'Chỉ tài khoản Admin mới có quyền phát lệnh cảnh báo khẩn cấp');
  await expect(page.getByRole('button', { name: 'Quản trị' })).toHaveCount(0);
});

test('admin: role label, enabled broadcast button, and an admin menu with its four tools', async ({ page }) => {
  await open(page, 'admin');
  await expect(page.locator('.nav-avatar')).toHaveText('EA');
  await expect(page.locator('.nav-user-role')).toHaveText('Lãnh đạo phê duyệt');
  await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Quản trị' }).click();
  const items = page.getByRole('menuitem');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('Vùng giám sát');
  await expect(items.nth(1)).toContainText('Quản trị người dùng');
  await expect(items.nth(2)).toContainText('Nhật ký quản trị');
  await expect(items.nth(3)).toContainText('Tình trạng hệ thống');
  await expect(items.nth(3)).toContainText('Dịch vụ đang chạy và độ tươi của dữ liệu'); // each item carries a hint
});

test('a menu button announces its state; opening one closes the other, a click outside closes it, a click on an item closes it', async ({ page }) => {
  await open(page, 'admin');
  const tools = page.getByRole('button', { name: 'Công cụ' });
  const admin = page.getByRole('button', { name: 'Quản trị' });
  await expect(tools).toHaveAttribute('aria-expanded', 'false');
  await expect(tools).toHaveAttribute('aria-haspopup', 'menu');
  await tools.click();
  await expect(tools).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menu')).toHaveCount(1);

  await admin.click(); // pressing elsewhere closes the first menu before the second opens
  await expect(tools).toHaveAttribute('aria-expanded', 'false');
  await expect(admin).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menu')).toHaveCount(1);

  await page.locator('.kpi-strip').click();
  await expect(page.getByRole('menu')).toHaveCount(0);

  await tools.click();
  await page.getByRole('menuitem', { name: /Thẻ mô hình/ }).click();
  await expect(page.getByRole('menu')).toHaveCount(0); // the menu closes and the dialog opens
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the menu button toggles: a second click closes the menu', async ({ page }) => {
  await open(page, 'officer');
  const tools = page.getByRole('button', { name: 'Công cụ' });
  await tools.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await tools.click();
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('connection chip shows the online state with the time of the last load', async ({ page }) => {
  await open(page, 'officer');
  await expect(page.locator('.status-chip')).toContainText(/^(Hệ thống trực tuyến|Trực tiếp) \(\d{2}:\d{2}:\d{2}\)$/);
  await expect(page.locator('.status-chip')).not.toHaveClass(/status-chip--error/);
});

test('connection chip turns to the error state when the queue cannot be loaded', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/review-queue' ? [500, {}] : undefined));
  await page.goto('/');
  await expect(page.locator('.status-chip')).toHaveText('Mất kết nối API');
  await expect(page.locator('.status-chip')).toHaveClass(/status-chip--error/);
  await expect(page.locator('.status-chip')).toHaveAttribute('title', /Không tải được hàng đợi dự báo/);
});

test('sound button: off by default, one click turns it on (and the tooltip says how to turn it off), a second click turns it off', async ({ page }) => {
  await open(page, 'officer');
  await expect(page.getByTitle('Bật âm báo (phát tiếng bíp thật)')).toBeVisible();
  await page.getByTitle('Bật âm báo (phát tiếng bíp thật)').click();
  await expect(page.getByTitle('Tắt âm báo')).toBeVisible();
  await page.getByTitle('Tắt âm báo').click();
  await expect(page.getByTitle('Bật âm báo (phát tiếng bíp thật)')).toBeVisible();
});

test('"Demo mô hình" link is in the top bar; sign-out clears the stored session and returns to the login page', async ({ page }) => {
  await open(page, 'officer');
  await expect(page.getByRole('link', { name: 'Demo mô hình' })).toHaveAttribute('href', '/model-demo');
  await page.getByTitle('Đăng xuất').click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => [localStorage.getItem('terrawatch_token'), localStorage.getItem('terrawatch_user')])).toEqual([null, null]);
});

// (the helper re-seeds the fake session on every page load, so only the redirect can be asserted here, not the cleared storage)
test('a 401 from the API (expired session) sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/review-queue' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

// ---- mobile tab bar (<= 768 px) ----
test.describe('mobile', () => {
  test.use({ viewport: { width: 600, height: 800 } });

  test('tab bar shows Danh sách and Bản đồ; the map is the default; switching swaps the queue and the map', async ({ page }) => {
    await open(page, 'officer');
    const bar = page.getByRole('tablist', { name: 'Điều hướng giao diện di động' });
    await expect(bar.getByRole('tab')).toHaveText(['Danh sách', 'Bản đồ']);
    await expect(bar.getByRole('tab', { name: 'Bản đồ' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.map-canvas-area')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeHidden();

    await bar.getByRole('tab', { name: 'Danh sách' }).click();
    await expect(bar.getByRole('tab', { name: 'Danh sách' })).toHaveAttribute('aria-selected', 'true');
    await expect(bar.getByRole('tab', { name: 'Bản đồ' })).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.map-canvas-area')).toBeHidden();

    await bar.getByRole('tab', { name: 'Bản đồ' }).click();
    await expect(page.locator('.sidebar')).toBeHidden();
    await expect(page.locator('.map-canvas-area')).toBeVisible();
  });

  test('picking a card in the list jumps to the map with that area selected', async ({ page }) => {
    await open(page, 'officer');
    await page.getByRole('tab', { name: 'Danh sách' }).click();
    await page.locator('.event-card', { hasText: 'Văn Chấn - E2E' }).click();
    await expect(page.getByRole('tab', { name: 'Bản đồ' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.map-hud-overlay')).toContainText('Văn Chấn - E2E');
  });

  test('keyboard shortcuts Alt+L and Alt+M switch tabs; typing in the search box does not trigger them', async ({ page }) => {
    await open(page, 'officer');
    await page.keyboard.press('Alt+l');
    await expect(page.getByRole('tab', { name: 'Danh sách' })).toHaveAttribute('aria-selected', 'true');
    await page.getByPlaceholder('Tìm khu vực...').click();
    await page.keyboard.press('Alt+m'); // focus is in an input: ignored
    await expect(page.getByRole('tab', { name: 'Danh sách' })).toHaveAttribute('aria-selected', 'true');
    await page.locator('.sidebar-title').click();
    await page.keyboard.press('Alt+m');
    await expect(page.getByRole('tab', { name: 'Bản đồ' })).toHaveAttribute('aria-selected', 'true');
  });

  test('menu buttons keep an accessible name when their text is hidden; the labels and the status chip are hidden', async ({ page }) => {
    await open(page, 'admin');
    await expect(page.locator('.top-nav .btn-label').first()).toBeHidden();
    await expect(page.locator('.status-chip')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Công cụ' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quản trị' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toBeVisible();
    await page.getByRole('button', { name: 'Công cụ' }).click();
    await expect(page.getByRole('menuitem')).toHaveCount(6);
  });
});
