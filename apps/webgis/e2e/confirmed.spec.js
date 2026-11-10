import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Story 4.38. The layer itself is drawn by WebGL (tiles are blocked in tests), so these tests cover the control and the data handling.

const FC = {
  type: 'FeatureCollection',
  features: [{
    id: 'e2e-1', type: 'Feature',
    geometry: { type: 'MultiPolygon', coordinates: [[[[104.11, 21.86], [104.116, 21.86], [104.116, 21.867], [104.11, 21.867], [104.11, 21.86]]]] },
    properties: { event_id: 'e2e-1', risk_level: 'extreme', area_m2: 480000, slope: 43.5, confidence: 0.96, scene_id: 'S2B_E2E', verified_at: '2026-10-08T03:28:52Z' }
  }]
};

test('with confirmed landslides the map offers a toggle with their count', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/landslides/active') return FC;
    if (path === '/forecasts/review-queue') return [forecastItem('run-c', 'Điểm E2E', 'high')];
  });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Sạt lở đã xác nhận (1)' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false'); // off until asked: switching on flies to the points
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('no confirmed landslides (or the call fails): no toggle, dashboard still works', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/landslides/active') return [500, { message: 'boom' }];
    if (path === '/forecasts/review-queue') return [forecastItem('run-d', 'Điểm E2E', 'high')];
  });
  await page.goto('/');
  await expect(page.getByLabel('Tổng quan tình hình')).toContainText('Chờ thẩm định');
  await expect(page.getByRole('button', { name: /Sạt lở đã xác nhận/ })).toHaveCount(0);
});

// Story 4.39
test('broken geometry from the server is dropped: no toggle, no crash', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/landslides/active') {
      return { type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: {}, properties: { risk_level: 'high' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [null] }, properties: { risk_level: 'high' } }
      ] };
    }
    if (path === '/forecasts/review-queue') return [forecastItem('run-e', 'Điểm E2E', 'high')];
  });
  await page.goto('/');
  await expect(page.getByLabel('Tổng quan tình hình')).toContainText('Chờ thẩm định');
  await expect(page.getByRole('button', { name: /Sạt lở đã xác nhận/ })).toHaveCount(0);
});

test('a manual refresh reloads the queue but does not re-download the confirmed landslides', async ({ page }) => {
  const calls = await mockBackend(page, 'officer', ({ path }) => {
    if (path === '/landslides/active') return FC;
    if (path === '/forecasts/review-queue') return [forecastItem('run-f', 'Điểm E2E', 'high')];
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sạt lở đã xác nhận (1)' })).toBeVisible();
  const count = (p) => calls.filter(c => c.path === p).length;
  await page.waitForTimeout(1000); // the dev server's double mount settles
  const [queue0, confirmed0] = [count('/forecasts/review-queue'), count('/landslides/active')];
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect.poll(() => count('/forecasts/review-queue')).toBeGreaterThan(queue0);
  expect(count('/landslides/active')).toBe(confirmed0);
});
