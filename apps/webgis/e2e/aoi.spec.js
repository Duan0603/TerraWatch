import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool } from './helpers.js';

// Mocked API: monitoring areas are never created or changed for real.
// The modal has no delete action in the current source, so there is no delete test.

const ring = [[104.1, 21.8], [104.3, 21.8], [104.3, 21.95], [104.1, 21.95], [104.1, 21.8]];
const area = (id, name, extra = {}) => ({
  area_id: id, name, description: `Mô tả ${name}`, is_active: true, created_at: '2026-10-01T03:00:00Z',
  geometry_geojson: JSON.stringify({ type: 'Polygon', coordinates: [ring] }), ...extra
});

async function openAoi(page, { areas, onCall } = {}) {
  const rows = areas ?? [area(1, 'Vùng Sa Pa E2E'), area(2, 'Vùng Mù Cang Chải E2E', { is_active: false, description: null })];
  const calls = await mockBackend(page, 'admin', (c) => {
    if (c.path === '/monitoring-areas' && c.method === 'GET') return rows;
    return onCall?.(c, rows);
  });
  await page.goto('/');
  await openAdminTool(page, 'Vùng giám sát');
  await expect(page.getByRole('heading', { name: /QUẢN LÝ VÙNG GIÁM SÁT/ })).toBeVisible();
  return { calls, rows };
}

const writes = (calls) => calls.filter((c) => c.method !== 'GET');
const card = (page, name) => page.getByText(name, { exact: true });
const nameInput = (page) => page.getByPlaceholder('Ví dụ: Vùng Cảnh Báo Sạt Lở Sa Pa');

test('lists areas with status, description fallback and id', async ({ page }) => {
  await openAoi(page);
  await expect(card(page, 'Vùng Sa Pa E2E')).toBeVisible();
  await expect(page.getByText('Mô tả Vùng Sa Pa E2E')).toBeVisible();
  await expect(page.getByText('Không có mô tả')).toBeVisible();
  await expect(page.getByText('HOẠT ĐỘNG', { exact: true })).toHaveCount(1);
  await expect(page.getByText('TẠM TẮT', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Mã vùng: #2')).toBeVisible();
});

test('search filters the list; no match shows the empty text', async ({ page }) => {
  await openAoi(page);
  await page.getByPlaceholder('Tìm kiếm vùng giám sát...').fill('Mù Cang');
  await expect(card(page, 'Vùng Sa Pa E2E')).toHaveCount(0);
  await expect(card(page, 'Vùng Mù Cang Chải E2E')).toBeVisible();
  await page.getByPlaceholder('Tìm kiếm vùng giám sát...').fill('không-có-vùng-này');
  await expect(page.getByText('Không tìm thấy vùng giám sát nào.')).toBeVisible();
});

test('a failed list load shows the error', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/monitoring-areas' ? [500, {}] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Vùng giám sát');
  await expect(page.getByRole('alert')).toContainText('Không tải được danh sách vùng giám sát');
});

test('creating needs a name; a valid create sends POST and the list shows the new area', async ({ page }) => {
  const { calls } = await openAoi(page, {
    onCall: ({ method, path, body }, rows) => {
      if (method === 'POST' && path === '/monitoring-areas') {
        rows.push(area(3, body.name, { description: body.description }));
        return { area_id: 3 };
      }
    }
  });
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).click();
  // the name input is `required`, so the browser blocks the submit before the app's own message
  await expect(nameInput(page)).toHaveJSProperty('validity.valueMissing', true);
  expect(writes(calls)).toEqual([]);

  await nameInput(page).fill('   '); // blank passes `required`, the app refuses it itself
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).click();
  await expect(page.getByRole('alert')).toHaveText('Vui lòng nhập tên vùng giám sát.');
  expect(writes(calls)).toEqual([]);

  await nameInput(page).fill('  Vùng Mới E2E  ');
  await page.getByPlaceholder('Ví dụ: Khu vực các sườn dốc dọc tuyến đèo quốc lộ 4D').fill('Mô tả mới');
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).click();
  await expect(page.getByText('Đã lưu thành công!')).toBeVisible();
  await expect(card(page, 'Vùng Mới E2E')).toBeVisible();
  const [post] = writes(calls);
  expect(post).toMatchObject({ method: 'POST', path: '/monitoring-areas' });
  expect(post.body).toMatchObject({ name: 'Vùng Mới E2E', description: 'Mô tả mới' });
  expect(post.body.geojson.type).toBe('Polygon');
  expect(post.body.geojson.coordinates[0].length).toBeGreaterThanOrEqual(4);
});

test('a duplicate name (409) shows the duplicate-name message and keeps the typed form', async ({ page }) => {
  await openAoi(page, { onCall: ({ method }) => (method === 'POST' ? [409, { message: 'duplicate' }] : undefined) });
  await nameInput(page).fill('Vùng Sa Pa E2E');
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).click();
  await expect(page.getByRole('alert')).toHaveText('Đã có vùng giám sát mang tên này. Hãy đặt tên khác.');
  await expect(nameInput(page)).toHaveValue('Vùng Sa Pa E2E');
  await expect(page.getByText('Đã lưu thành công!')).toHaveCount(0);
});

test('an invalid boundary (400) shows the boundary message', async ({ page }) => {
  await openAoi(page, { onCall: ({ method }) => (method === 'POST' ? [400, {}] : undefined) });
  await nameInput(page).fill('Vùng hình nơ');
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).click();
  await expect(page.getByRole('alert')).toContainText('Ranh giới vùng không hợp lệ');
});

test('a self-crossing boundary is refused in the browser, no request is sent', async ({ page }) => {
  const { calls } = await openAoi(page);
  await nameInput(page).fill('Vùng nơ');
  await page.locator('textarea').fill(JSON.stringify([[104, 21], [105, 22], [105, 21], [104, 22], [104, 21]]));
  await page.getByRole('button', { name: 'Lưu Vùng Giám Sát' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'nên không hợp lệ' })).toContainText('tự cắt nhau');
  expect(writes(calls)).toEqual([]);
});

test('renaming a selected area sends PUT with the new name and keeps its boundary', async ({ page }) => {
  const { calls } = await openAoi(page, {
    onCall: ({ method, path, body }, rows) => {
      if (method === 'PUT' && path === '/monitoring-areas/1') {
        Object.assign(rows[0], { name: body.name, description: body.description, is_active: body.isActive });
        return {};
      }
    }
  });
  await card(page, 'Vùng Sa Pa E2E').click();
  await expect(page.getByRole('heading', { name: 'Sửa Vùng Giám Sát: Vùng Sa Pa E2E' })).toBeVisible();
  await expect(nameInput(page)).toHaveValue('Vùng Sa Pa E2E');
  await nameInput(page).fill('Vùng Sa Pa Đã Đổi Tên');
  await page.getByLabel(/Kích hoạt giám sát/).uncheck();
  await page.getByRole('button', { name: 'Cập Nhật Vùng' }).click();
  await expect(page.getByText('Đã lưu thành công!')).toBeVisible();
  await expect(card(page, 'Vùng Sa Pa Đã Đổi Tên')).toBeVisible();
  await expect(card(page, 'Vùng Sa Pa E2E')).toHaveCount(0);
  const [put] = writes(calls);
  expect(put).toMatchObject({ method: 'PUT', path: '/monitoring-areas/1' });
  expect(put.body).toMatchObject({ name: 'Vùng Sa Pa Đã Đổi Tên', isActive: false, geojson: { type: 'Polygon', coordinates: [ring] } });
});
