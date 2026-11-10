import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Story 4.36. The dashboard was split into a data hook + one dialog state: every toolbar dialog must still open and Escape must close it.
// Only the model card has role="dialog"; the others are found by their <h3> title.

for (const name of ['Thẻ mô hình', 'Nhật ký thẩm định', 'Báo cáo hiện trường', 'Lịch sử lệnh']) {
  test(`"${name}" opens a dialog and Escape closes it`, async ({ page }) => {
    await mockBackend(page, 'officer', () => undefined);
    await page.goto('/');
    const marker = page.locator('h3, [role="dialog"]');
    const before = await marker.count();
    await page.getByRole('button', { name }).click();
    await expect.poll(() => marker.count()).toBeGreaterThan(before);
    await page.keyboard.press('Escape');
    await expect.poll(() => marker.count()).toBe(before);
  });
}
