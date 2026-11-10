import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Story 4.36. The dashboard was split into a data hook + one dialog state: every toolbar dialog must still open and Escape must close it.
// Only the model card has role="dialog"; the others are found by their <h3> title.

for (const name of ['Thẻ mô hình', 'Nhật ký thẩm định', 'Báo cáo hiện trường', 'Lịch sử lệnh']) {
  test(`"${name}" opens a dialog and Escape closes it`, async ({ page }) => {
    await mockBackend(page, 'officer', () => undefined);
    await page.goto('/');
    const marker = page.locator('h3, [role="dialog"]');
    const before = await marker.count();
    await openTool(page, name);
    await expect.poll(() => marker.count()).toBeGreaterThan(before);
    await page.keyboard.press('Escape');
    await expect.poll(() => marker.count()).toBe(before);
  });
}

// Story 4.37: at 1440 px the admin bar keeps its text labels and does not overflow.
for (const role of ['officer', 'admin']) {
  test(`${role} top bar at 1440 px: labels visible, no overflow, tools menu lists 5 items`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockBackend(page, role, () => undefined);
    await page.goto('/');
    await expect(page.locator('.top-nav .btn-label', { hasText: 'Công cụ' })).toBeVisible();
    const fits = await page.locator('.top-nav').evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
    await page.getByRole('button', { name: 'Công cụ' }).click();
    await expect(page.getByRole('menuitem')).toHaveCount(5);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
}
