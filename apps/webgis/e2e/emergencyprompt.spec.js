import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. After a high or extreme proposal is approved the dashboard shows a prompt. It only opens the send form:
// it never sends anything itself. review.spec.js approves a medium proposal on purpose (no prompt), so this file covers the prompt.

async function openQueue(page, role) {
  const items = [
    forecastItem('run-high', 'Mù Cang Chải - E2E', 'high'),
    forecastItem('run-extreme', 'Sa Pa - E2E', 'extreme'),
    forecastItem('run-medium', 'Văn Chấn - E2E', 'medium')
  ];
  const calls = await mockBackend(page, role, ({ method, path, body }) => {
    if (path === '/forecasts/review-queue') return items;
    const m = path.match(/^\/forecasts\/(.+)\/review$/);
    if (m && method === 'PATCH') {
      items.find((i) => i.runId === m[1]).reviewStatus = body.decision;
      return {};
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Chờ duyệt \(3\)/ })).toBeVisible();
  return { calls, card: (name) => page.locator('.event-card', { hasText: name }) };
}
const approve = async (page, card) => {
  await card.getByRole('button', { name: 'Phê duyệt' }).click();
  await page.getByRole('button', { name: 'Xác nhận phê duyệt' }).click();
};
const prompt = (page) => page.locator('.alert-prompt-wrapper');

test('admin approves a high proposal: the prompt names the risk and area and offers to compose, nothing is sent', async ({ page }) => {
  const { calls, card } = await openQueue(page, 'admin');
  await approve(page, card('Mù Cang Chải - E2E'));
  await expect(prompt(page)).toContainText('Đã phê duyệt — Nguy cơ HIGH');
  await expect(prompt(page)).toContainText('Mù Cang Chải - E2E');
  await expect(prompt(page)).toContainText('Dự báo hiệu lực đến');
  await expect(prompt(page).getByRole('button', { name: 'Soạn cảnh báo' })).toBeVisible();
  expect(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`)).toEqual(['PATCH /forecasts/run-high/review']);
});

test('an extreme proposal raises the prompt too', async ({ page }) => {
  const { card } = await openQueue(page, 'admin');
  await approve(page, card('Sa Pa - E2E'));
  await expect(prompt(page)).toContainText('Nguy cơ EXTREME');
});

test('"Soạn cảnh báo" closes the prompt and opens the send form; still nothing is posted but the review', async ({ page }) => {
  const { calls, card } = await openQueue(page, 'admin');
  await approve(page, card('Mù Cang Chải - E2E'));
  await prompt(page).getByRole('button', { name: 'Soạn cảnh báo' }).click();
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('PHÁT LỆNH CẢNH BÁO THIÊN TAI KHẨN CẤP');
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});

test('the close button and Escape dismiss the prompt', async ({ page }) => {
  const { card } = await openQueue(page, 'admin');
  await approve(page, card('Mù Cang Chải - E2E'));
  await prompt(page).getByTitle('Đóng').click();
  await expect(prompt(page)).toHaveCount(0);

  await approve(page, card('Sa Pa - E2E'));
  await expect(prompt(page)).toContainText('Nguy cơ EXTREME');
  await page.keyboard.press('Escape');
  await expect(prompt(page)).toHaveCount(0);
});

test('an officer gets the same prompt but only a note: no compose button, since only admins may broadcast', async ({ page }) => {
  const { card } = await openQueue(page, 'officer');
  await approve(page, card('Mù Cang Chải - E2E'));
  await expect(prompt(page)).toContainText('Đã phê duyệt — Nguy cơ HIGH');
  await expect(prompt(page)).toContainText('Chỉ Admin được phát cảnh báo cho người dân');
  await expect(prompt(page).getByRole('button', { name: 'Soạn cảnh báo' })).toHaveCount(0);
  await expect(prompt(page).getByTitle('Đóng')).toBeVisible();
});

test('no prompt after approving a medium proposal or rejecting a high one', async ({ page }) => {
  const { card } = await openQueue(page, 'admin');
  await approve(page, card('Văn Chấn - E2E'));
  await expect(page.getByRole('button', { name: /Chờ duyệt \(2\)/ })).toBeVisible(); // the review went through
  await expect(prompt(page)).toHaveCount(0);

  await card('Mù Cang Chải - E2E').getByRole('button', { name: 'Từ chối' }).click();
  await page.getByPlaceholder('Lý do từ chối (bắt buộc)').fill('Không khớp mưa thực đo');
  await page.getByRole('button', { name: 'Xác nhận từ chối' }).click();
  await expect(page.getByRole('button', { name: /Chờ duyệt \(1\)/ })).toBeVisible();
  await expect(prompt(page)).toHaveCount(0);
});
