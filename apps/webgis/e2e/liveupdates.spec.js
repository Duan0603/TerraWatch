import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Story 4.35. The stream is faked: an "update" event must make the dashboard reload the queue by itself.

const EVENTS = ['event: hello', 'data: {}', '', 'event: update', 'data: {"type":"queue"}', '', ''].join('\n');

test('an update event reloads the queue without waiting for the 60 s refresh', async ({ page }) => {
  const calls = await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/forecasts/review-queue') return [forecastItem('run-live', 'Điểm trực tiếp E2E', 'high')];
  });
  // Registered after mockBackend, so it wins over the catch-all. The event is held back until the first loads are done,
  // so the extra queue call can only come from the "update".
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/v1/stream', async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      contentType: 'text/event-stream',
      body: EVENTS
    });
  });

  await page.goto('/');
  const queueCalls = () => calls.filter((c) => c.path === '/forecasts/review-queue').length;
  await expect.poll(queueCalls).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(1500); // the dashboard's own first loads settle
  const before = queueCalls();
  release();
  await expect.poll(queueCalls, { timeout: 8_000 }).toBeGreaterThan(before);
});

test('a stream that is refused with 403 does not break the dashboard', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/forecasts/review-queue') return [forecastItem('run-403', 'Điểm E2E', 'high')];
  });
  await page.route('**/api/v1/stream', (route) => route.fulfill({
    status: 403, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: '{"message":"Forbidden"}'
  }));

  await page.goto('/');
  await expect(page.getByLabel('Tổng quan tình hình')).toContainText('Chờ thẩm định');
  await expect(page.getByText('Hệ thống trực tuyến')).toBeVisible();
});
