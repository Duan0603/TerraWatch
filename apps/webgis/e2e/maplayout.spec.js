import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Story 4.40. The info card (top-left) and the map buttons (top-right) must never overlap, whatever the window width.

const FC = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[104.11, 21.86], [104.116, 21.86], [104.116, 21.867], [104.11, 21.86]]] },
    properties: { risk_level: 'extreme', area_m2: 480000, slope: 43.5, confidence: 0.96, scene_id: 'S2B_E2E', verified_at: '2026-10-08T03:28:52Z' }
  }]
};

for (const width of [1100, 1280, 1440, 1600, 1920]) {
  test(`info card and map buttons do not overlap at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockBackend(page, 'officer', ({ path }) => {
      if (path === '/landslides/active') return FC;
      if (path === '/forecasts/review-queue') return [forecastItem('run-l', 'Điểm bố cục E2E', 'high')];
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sạt lở đã xác nhận (1)' })).toBeVisible();
    const box = (sel) => page.locator(sel).first().boundingBox();
    const hud = await box('.map-hud-overlay');
    const controls = await box('.map-floating-controls');
    expect(hud && controls).toBeTruthy();
    const overlap = hud.x < controls.x + controls.width && controls.x < hud.x + hud.width
      && hud.y < controls.y + controls.height && controls.y < hud.y + hud.height;
    expect(overlap, `hud ${JSON.stringify(hud)} vs controls ${JSON.stringify(controls)}`).toBe(false);
  });
}
