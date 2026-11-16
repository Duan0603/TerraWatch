import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool, holdGet } from './helpers.js';

// Mocked API (admin). "Vùng giám sát" (GET/POST/PUT /monitoring-areas). aoi.spec.js covers the list, search, a failed load (message text), create,
// 409, 400, self-crossing, rename. Here: loading, network failure, 401, malformed rows, a double click on the save button, the keyboard.
// UW-AOI-008 (empty) and UW-AOI-009 (500) are already covered there; UW-AOI-010, 011, 012, 013, 015 are new.

const ring = [[104.1, 21.8], [104.3, 21.8], [104.3, 21.95], [104.1, 21.95], [104.1, 21.8]];
const area = (id, name) => ({ area_id: id, name, description: `Mô tả ${name}`, is_active: true, created_at: '2026-10-01T03:00:00Z', geometry_geojson: JSON.stringify({ type: 'Polygon', coordinates: [ring] }) });
const ROWS = [area(1, 'Vùng Một E2E')];
const nameInput = (page) => page.getByPlaceholder('Ví dụ: Vùng Cảnh Báo Sạt Lở Sa Pa');
const heading = (page) => page.getByRole('heading', { name: /QUẢN LÝ VÙNG GIÁM SÁT/ });
const open = async (page) => {
  await page.goto('/');
  await openAdminTool(page, 'Vùng giám sát');
  await expect(heading(page)).toBeVisible();
};

test('UW-AOI-010: a network failure shows the client error text; reopening the dialog lists the areas once the network is back', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'admin', ({ path }) => (path === '/monitoring-areas' ? ROWS : undefined));
  await page.route('**/api/v1/monitoring-areas', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await open(page);
  await expect(page.getByRole('alert')).toHaveText('Không tải được danh sách vùng giám sát (Network Error)');
  await expect(page.getByText('Không tìm thấy vùng giám sát nào.')).toBeVisible();
  down = false;
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-x') }).first().click(); // close
  await expect(heading(page)).toHaveCount(0);
  await openAdminTool(page, 'Vùng giám sát');
  await expect(page.getByText('Vùng Một E2E', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('UW-AOI-011: a 401 from /monitoring-areas sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/monitoring-areas' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('UW-AOI-012: an area with a name but no description, no geometry and no created date still gets a card with the fallback text and no "undefined"', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/monitoring-areas' ? [{ area_id: 7, name: 'Vùng Trống E2E', is_active: true }] : undefined));
  await open(page);
  await expect(page.getByText('Vùng Trống E2E', { exact: true })).toBeVisible();
  await expect(page.getByText('Không có mô tả')).toBeVisible();
  await expect(page.getByText('Không tìm thấy vùng giám sát nào.')).toHaveCount(0);
  const card = page.locator('div', { has: page.getByText('Vùng Trống E2E', { exact: true }) }).last();
  await expect(card).not.toContainText('undefined'); // only the card: the KPI strip behind the dialog is fed by the default mock answers
  await expect(card).not.toContainText('Invalid');
});

test('UW-AOI-012: an object instead of a list is an empty list ("Không tìm thấy vùng giám sát nào."), with no alert', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/monitoring-areas' ? { not: 'a list' } : undefined));
  await open(page);
  await expect(page.getByText('Không tìm thấy vùng giám sát nào.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('UW-AOI-013: the save button says "Đang lưu..." and is disabled while the request is in flight, so a double click sends one POST', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ method, path }) => {
    if (path === '/monitoring-areas' && method === 'GET') return ROWS;
    if (path === '/monitoring-areas' && method === 'POST') return { area_id: 2 };
  });
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route('**/api/v1/monitoring-areas', async (route) => {
    if (route.request().method() === 'POST') await gate;
    await route.fallback();
  });
  await open(page);
  await nameInput(page).fill('Vùng Hai E2E');
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).dblclick();
  const busy = page.getByRole('button', { name: 'Đang lưu...' });
  await expect(busy).toBeDisabled();
  release();
  await expect(page.getByText('Đã lưu thành công!')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu Vùng Giám Sát' })).toBeEnabled();
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
});

test('UW-AOI-015: Tab moves from the name to the description; after selecting an area, "Hủy Sửa" is reachable and Enter on it returns to the create form', async ({ page }) => {
  const calls = await mockBackend(page, 'admin', ({ path, method }) => (path === '/monitoring-areas' && method === 'GET' ? ROWS : undefined));
  await open(page);
  await nameInput(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByPlaceholder('Ví dụ: Khu vực các sườn dốc dọc tuyến đèo quốc lộ 4D')).toBeFocused();
  await page.getByText('Vùng Một E2E', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sửa Vùng Giám Sát: Vùng Một E2E' })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy Sửa' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Sửa Vùng Giám Sát: Vùng Một E2E' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu Vùng Giám Sát' })).toBeVisible();
  expect(calls.filter((c) => c.method !== 'GET')).toEqual([]);
});
