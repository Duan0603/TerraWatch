import { test, expect } from '@playwright/test';
import { mockBackend, openAdminTool } from './helpers.js';

// Mocked API: the admin dialog must never touch real accounts.

const user = (id, fullName, role, extra = {}) => ({
  userId: id, fullName, email: `${fullName.split(' ').pop().toLowerCase()}@e2e.test`, role,
  isActive: true, approvalStatus: 'approved', phoneNumber: null, ...extra
});

async function openUsers(page, { users, onCall, selfId } = {}) {
  const rows = users ?? [
    user('u-admin', 'Admin Gốc', 'admin'),
    user('u-off', 'Cán Bộ Mới', 'officer', { approvalStatus: 'pending', departmentUnit: 'Phòng PCTT Yên Bái' }),
    user('u-cit', 'Dân Thường', 'citizen', { isActive: false, phoneNumber: '0912345678' })
  ];
  const calls = await mockBackend(page, 'admin', (c) => {
    if (c.path === '/admin/users' && c.method === 'GET') return rows;
    return onCall?.(c, rows);
  });
  if (selfId) {
    await page.addInitScript((id) => {
      localStorage.setItem('terrawatch_user', JSON.stringify({ userId: id, fullName: 'E2E admin', role: 'admin' }));
    }, selfId);
  }
  await page.goto('/');
  await openAdminTool(page, 'Quản trị người dùng');
  await expect(page.getByRole('heading', { name: /Quản Trị Người Dùng/ })).toBeVisible();
  return { calls, row: (name) => page.getByRole('row', { name: new RegExp(name) }) };
}

const writes = (calls) => calls.filter((c) => c.method !== 'GET');

test('lists accounts with counters, pending badge and department', async ({ page }) => {
  const { row } = await openUsers(page);
  await expect(page.getByText('Tổng tài khoản:').locator('xpath=following-sibling::span')).toHaveText('3');
  await expect(page.getByText('Cán bộ chờ duyệt:').locator('xpath=following-sibling::span')).toHaveText('1');
  await expect(page.getByText('Đang hoạt động:').locator('xpath=following-sibling::span')).toHaveText('2');
  await expect(page.getByText('Đã khóa:').locator('xpath=following-sibling::span')).toHaveText('1');
  await expect(row('Cán Bộ Mới')).toContainText('Chờ duyệt');
  await expect(row('Cán Bộ Mới')).toContainText('Đơn vị: Phòng PCTT Yên Bái');
  await expect(row('Dân Thường')).toContainText('0912345678');
  await expect(row('Dân Thường')).toContainText('Đã khóa');
});

test('shows the server message when the list cannot be loaded', async ({ page }) => {
  await mockBackend(page, 'admin', ({ path }) => (path === '/admin/users' ? [500, { message: 'Máy chủ đang bảo trì' }] : undefined));
  await page.goto('/');
  await openAdminTool(page, 'Quản trị người dùng');
  await expect(page.getByText('Máy chủ đang bảo trì')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('search and filters narrow the list; no match shows the empty state', async ({ page }) => {
  const { row } = await openUsers(page);
  await page.getByPlaceholder('Tìm theo tên, email, số điện thoại...').fill('0912');
  await expect(page.getByRole('row')).toHaveCount(2); // header + Dân Thường
  await expect(row('Dân Thường')).toBeVisible();
  await page.getByPlaceholder('Tìm theo tên, email, số điện thoại...').fill('');

  await page.getByText('Trạng thái:').locator('xpath=following-sibling::select').selectOption('PENDING');
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(row('Cán Bộ Mới')).toBeVisible();

  await page.getByText('Vai trò:').locator('xpath=following-sibling::select').selectOption('citizen');
  await expect(page.getByText('Không tìm thấy người dùng phù hợp với tiêu chí lọc')).toBeVisible();
});

test('approving a pending officer sends POST /approve and reloads the list', async ({ page }) => {
  const { calls, row } = await openUsers(page, {
    onCall: ({ method, path }, rows) => {
      if (method === 'POST' && path === '/admin/users/u-off/approve') {
        rows.find((u) => u.userId === 'u-off').approvalStatus = 'approved';
        return {};
      }
    }
  });
  await row('Cán Bộ Mới').getByRole('button', { name: 'Duyệt' }).click();
  await expect(page.getByText('Đã phê duyệt tài khoản cán bộ: Cán Bộ Mới')).toBeVisible();
  await expect(row('Cán Bộ Mới')).toContainText('Đã duyệt');
  await expect(row('Cán Bộ Mới').getByRole('button', { name: 'Duyệt' })).toHaveCount(0);
  expect(writes(calls)).toEqual([{ method: 'POST', path: '/admin/users/u-off/approve', body: null }]);
});

test('rejecting an officer asks for confirmation first; cancel sends nothing', async ({ page }) => {
  const { calls, row } = await openUsers(page, {
    onCall: ({ method, path }, rows) => {
      if (method === 'POST' && path === '/admin/users/u-off/reject') {
        rows.find((u) => u.userId === 'u-off').approvalStatus = 'rejected';
        return {};
      }
    }
  });
  await row('Cán Bộ Mới').getByRole('button', { name: 'Từ chối' }).click();
  const ask = page.getByRole('alertdialog', { name: 'Xác nhận thao tác' });
  await expect(ask).toContainText('Bạn có chắc muốn từ chối tài khoản cán bộ của Cán Bộ Mới?');
  await ask.getByRole('button', { name: 'Hủy' }).click();
  await expect(ask).toHaveCount(0);
  expect(writes(calls)).toEqual([]);

  await row('Cán Bộ Mới').getByRole('button', { name: 'Từ chối' }).click();
  await ask.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã từ chối tài khoản cán bộ: Cán Bộ Mới')).toBeVisible();
  await expect(row('Cán Bộ Mới')).toContainText('Từ chối');
  expect(writes(calls)).toEqual([{ method: 'POST', path: '/admin/users/u-off/reject', body: null }]);
});

test('lock and unlock confirm in-app, send PATCH /status and update the row', async ({ page }) => {
  const { calls, row } = await openUsers(page, {
    onCall: ({ method, path, body }, rows) => {
      const m = path.match(/^\/admin\/users\/(.+)\/status$/);
      if (m && method === 'PATCH') { rows.find((u) => u.userId === m[1]).isActive = body.isActive; return {}; }
    }
  });
  const ask = page.getByRole('alertdialog', { name: 'Xác nhận thao tác' });

  await row('Dân Thường').getByRole('button', { name: 'Mở khóa' }).click();
  await expect(ask).toContainText('Bạn có chắc chắn muốn mở khóa tài khoản Dân Thường?');
  await ask.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã mở khóa tài khoản thành công')).toBeVisible();
  await expect(row('Dân Thường')).toContainText('Hoạt động');

  await row('Dân Thường').getByRole('button', { name: 'Khóa' }).click();
  await expect(ask).toContainText('Bạn có chắc chắn muốn khóa tài khoản Dân Thường?');
  await ask.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Đã khóa tài khoản thành công')).toBeVisible();
  await expect(row('Dân Thường')).toContainText('Đã khóa');

  expect(writes(calls)).toEqual([
    { method: 'PATCH', path: '/admin/users/u-cit/status', body: { isActive: true } },
    { method: 'PATCH', path: '/admin/users/u-cit/status', body: { isActive: false } }
  ]);
});

test('a failed lock shows the server message and leaves the row unchanged', async ({ page }) => {
  const { row } = await openUsers(page, {
    onCall: ({ method, path }) => (method === 'PATCH' && path.endsWith('/status') ? [409, { message: 'Không thể khóa quản trị viên cuối cùng' }] : undefined)
  });
  await row('Admin Gốc').getByRole('button', { name: 'Khóa' }).click();
  await page.getByRole('alertdialog', { name: 'Xác nhận thao tác' }).getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('Không thể khóa quản trị viên cuối cùng')).toBeVisible();
  await expect(row('Admin Gốc')).toContainText('Hoạt động');
});

test('changing a role sends PATCH /role and shows the new role', async ({ page }) => {
  const { calls, row } = await openUsers(page, {
    onCall: ({ method, path, body }, rows) => {
      const m = path.match(/^\/admin\/users\/(.+)\/role$/);
      if (m && method === 'PATCH') { rows.find((u) => u.userId === m[1]).role = body.role; return {}; }
    }
  });
  await row('Dân Thường').getByRole('combobox').selectOption('officer');
  await expect(page.getByText('Đã cập nhật vai trò sang OFFICER')).toBeVisible();
  await expect(row('Dân Thường').getByRole('combobox')).toHaveValue('officer');
  expect(writes(calls)).toEqual([{ method: 'PATCH', path: '/admin/users/u-cit/role', body: { role: 'officer' } }]);
});

test('an admin cannot lock or demote their own account', async ({ page }) => {
  const { row } = await openUsers(page, { selfId: 'u-admin' });
  await expect(row('Admin Gốc').getByRole('button', { name: 'Khóa' })).toBeDisabled();
  await expect(row('Admin Gốc').getByRole('combobox')).toBeDisabled();
  await expect(row('Dân Thường').getByRole('button', { name: 'Mở khóa' })).toBeEnabled();
});
