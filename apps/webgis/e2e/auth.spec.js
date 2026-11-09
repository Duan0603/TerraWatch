import { test, expect } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers.js';

// Real gateway API (localhost:8080). Signing in changes nothing in the database.

test.describe('sign-in by role', () => {
  test('admin lands on the command center', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.nav-user-role')).toHaveText('Lãnh đạo phê duyệt');
  });

  test('officer lands on the command center', async ({ page }) => {
    await signIn(page, ACCOUNTS.officer);
    await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.nav-user-role')).toHaveText('Cán bộ giám sát');
    await expect(page.getByRole('button', { name: /Quản trị người dùng/ })).toHaveCount(0); // admin-only
  });

  test('citizen lands on the citizen screen', async ({ page }) => {
    await signIn(page, ACCOUNTS.citizen);
    await expect(page.getByText('Cảnh báo sạt lở cho người dân')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('button', { name: 'Phát cảnh báo' })).toHaveCount(0);
  });

  test('wrong password shows the error and stays on /login', async ({ page }) => {
    await signIn(page, ACCOUNTS.officer, 'not-the-password-123');
    await expect(page.getByRole('alert')).toHaveText('Email hoặc mật khẩu không đúng.');
    await expect(page).toHaveURL(/\/login/);
  });
});
