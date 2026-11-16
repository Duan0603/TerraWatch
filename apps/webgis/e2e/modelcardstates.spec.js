import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Mocked API (officer). The model card dialog (GET /model-card). modelcard.spec.js covers the happy card and the "AI service down" card;
// here: loading, server error, network failure with retry, a 401, a card with missing fields, a single request per refresh, keyboard.
// UW-DASH-080 (500), 081 (network), 082 (401), 083 (missing fields), 084 (double click), 086 (Tab). UW-DASH-079 (empty) is already
// asserted by modelcard.spec.js ("when the AI service is down").

const CARD = { segmentation: { ready: true, name: 'e2e-seg', version: 'v1', modes: { balanced: 0.7 }, default_mode: 'balanced' }, gru: { ready: false } };
const dlg = (page) => page.getByRole('dialog', { name: 'Thẻ mô hình' });
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function open(page, answer) {
  const calls = await mockBackend(page, 'officer', ({ path }) => (path === '/model-card' ? answer() : undefined));
  await page.goto('/');
  await openTool(page, 'Thẻ mô hình');
  await expect(dlg(page)).toBeVisible();
  return calls;
}

test('UW-DASH-080: a 500 shows the server message in an alert, no card, and the dialog can still be closed', async ({ page }) => {
  await open(page, () => [500, { message: 'AI service không phản hồi.' }]);
  await expect(dlg(page).getByRole('alert')).toHaveText('AI service không phản hồi.');
  await expect(dlg(page)).not.toContainText('Ba chế độ vận hành');
  await dlg(page).getByRole('button', { name: 'Đóng' }).click();
  await expect(dlg(page)).toHaveCount(0);
});

test('UW-DASH-080: a 500 without a message falls back to the status text from the HTTP client', async ({ page }) => {
  await open(page, () => [500, {}]);
  await expect(dlg(page).getByRole('alert')).toHaveText('Request failed with status code 500');
});

test('UW-DASH-081: a network failure shows an error and Làm mới loads the card once the network is back', async ({ page }) => {
  let down = true;
  await mockBackend(page, 'officer', ({ path }) => (path === '/model-card' ? CARD : undefined));
  await page.route('**/api/v1/model-card', (route) => (down ? route.abort('connectionrefused') : route.fallback()));
  await page.goto('/');
  await openTool(page, 'Thẻ mô hình');
  await expect(dlg(page).getByRole('alert')).toHaveText('Network Error');
  await expect(dlg(page)).not.toContainText('e2e-seg');
  down = false;
  await dlg(page).getByRole('button', { name: 'Tải lại' }).click();
  await expect(dlg(page)).toContainText('e2e-seg');
  await expect(dlg(page).getByRole('alert')).toHaveCount(0); // the old error is gone
});

test('UW-DASH-082: a 401 sends the user to the login page', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/model-card' ? [401, { message: 'expired' }] : undefined));
  await page.goto('/');
  await openTool(page, 'Thẻ mô hình');
  await expect(page).toHaveURL(/\/login/);
});

test('UW-DASH-083: a card with fields missing shows "chưa có" in their rows, not "undefined" or a crash', async ({ page }) => {
  await open(page, () => ({ segmentation: { ready: true }, gru: { ready: true } }));
  const d = dlg(page);
  await expect(d).toContainText('Mô hình phân đoạn ảnh vệ tinh');
  await expect(d.getByText('Tên', { exact: true }).locator('xpath=..')).toContainText('chưa có');
  await expect(d.getByText('Kiểm tra tệp mô hình (SHA-256)').locator('xpath=..')).toContainText('chưa có'); // not "Khớp" and not "KHÔNG khớp"
  await expect(d.getByText('Mã băm điểm kiểm (SHA-256)').locator('xpath=..')).toContainText('chưa có');
  await expect(d).not.toContainText('undefined');
  await expect(d).not.toContainText('NaN');
});

// ponytail: the fix is in utils/modelCard.js (guard Array.isArray before join); until then the dialog shows the raw JavaScript error.
test.fixme('UW-DASH-083: a field of the wrong type does not leak a raw JavaScript error into the dialog', async ({ page }) => {
  // BUG: expected a readable row ("chưa có") or a user-facing message; actual: the alert reads "(c.input_channels || []).join is not a function".
  await open(page, () => ({ segmentation: { ready: true, input_channels: 'B2' } }));
  await expect(dlg(page).getByRole('alert')).not.toContainText('is not a function');
});

test('UW-DASH-084: while the card loads it says so and Làm mới is disabled; a double click on Làm mới sends one request', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let hold = true;
  await mockBackend(page, 'officer', () => undefined);
  await page.route('**/api/v1/model-card', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (hold) await gate;
    await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify(CARD) });
  });
  const seen = [];
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().endsWith('/api/v1/model-card')) seen.push(r.url()); });
  await page.goto('/');
  await openTool(page, 'Thẻ mô hình');
  await expect(dlg(page)).toContainText('Đang tải…');
  await expect(dlg(page).getByRole('button', { name: 'Tải lại' })).toBeDisabled();
  hold = false;
  release();
  await expect(dlg(page)).toContainText('e2e-seg');
  await expect(dlg(page)).not.toContainText('Đang tải…');
  expect(seen).toHaveLength(1);

  await dlg(page).getByRole('button', { name: 'Tải lại' }).dblclick();
  await expect(dlg(page)).toContainText('e2e-seg');
  await expect.poll(() => seen.length).toBe(2); // one more request, not two
});

test('UW-DASH-086: Tab walks through the dialog controls: Làm mới, then Đóng', async ({ page }) => {
  await open(page, () => CARD);
  await expect(dlg(page)).toContainText('e2e-seg');
  await dlg(page).getByRole('button', { name: 'Tải lại' }).focus();
  await page.keyboard.press('Tab');
  await expect(dlg(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
});
