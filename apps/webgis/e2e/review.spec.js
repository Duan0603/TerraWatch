import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API: reviewing must never change the real forecast data.

// Fake review queue that really changes state on PATCH, like the server does.
async function openQueue(page) {
  const items = [
    forecastItem('run-high', 'Mù Cang Chải - E2E', 'high'),
    forecastItem('run-medium', 'Văn Chấn - E2E', 'medium') // medium: approving it raises no emergency prompt
  ];
  const calls = await mockBackend(page, 'officer', ({ method, path, body }) => {
    if (path === '/forecasts/review-queue') return items;
    const m = path.match(/^\/forecasts\/(.+)\/review$/);
    if (m && method === 'PATCH') {
      items.find((i) => i.runId === m[1]).reviewStatus = body.decision;
      return {};
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Chờ duyệt \(2\)/ })).toBeVisible();
  return { calls, card: (name) => page.locator('.event-card', { hasText: name }) };
}

async function reject(page, card) {
  await card.click();
  await expect(card).toHaveClass(/selected/);
  await card.getByRole('button', { name: 'Từ chối' }).click();
  const confirm = page.getByRole('button', { name: 'Xác nhận từ chối' });
  await expect(confirm).toBeDisabled(); // a rejection needs a reason
  await page.getByPlaceholder('Lý do từ chối (bắt buộc)').fill('Mưa thực đo thấp hơn dự báo');
  await confirm.click();
}

test('officer rejects a pending proposal; the reason is required and sent', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await reject(page, card('Mù Cang Chải - E2E'));

  await expect(page.getByRole('button', { name: /Chờ duyệt \(1\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Từ chối \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Tất cả \(2\)/ }).click();
  await expect(card('Mù Cang Chải - E2E').locator('.event-status')).toContainText('Đã từ chối');
  expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body))
    .toEqual([{ decision: 'rejected', reasonNotes: 'Mưa thực đo thấp hơn dự báo' }]);
});

test('officer approves a pending proposal', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await card('Văn Chấn - E2E').getByRole('button', { name: 'Phê duyệt' }).click();
  await page.getByRole('button', { name: 'Xác nhận phê duyệt' }).click(); // note is optional

  await expect(page.getByRole('button', { name: /Đã duyệt \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Tất cả \(2\)/ }).click();
  await expect(card('Văn Chấn - E2E').locator('.event-status')).toContainText('Đã phê duyệt');
  expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body))
    .toEqual([{ decision: 'approved', reasonNotes: null }]);
});

// Regression: ReviewDialog stays mounted, so it used to keep the previous reason and a stuck "Đang gửi..." button.
test('officer can review a second proposal without reloading', async ({ page }) => {
  const { card } = await openQueue(page);
  await reject(page, card('Mù Cang Chải - E2E'));
  await expect(page.getByRole('button', { name: /Từ chối \(1\)/ })).toBeVisible();
  await card('Văn Chấn - E2E').getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(page.getByPlaceholder('Ghi chú (không bắt buộc)')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Xác nhận phê duyệt' })).toBeEnabled();
});
