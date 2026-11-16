import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API (admin; the officer sees the same review dialog). Error and keyboard states of the review dialog, the emergency prompt and
// the forecast comparison dialog. review.spec.js, verificationqueue.spec.js and emergencyprompt.spec.js cover the happy paths, a 409,
// the Hủy button, the close button and Escape of the prompt.
// Here: ReviewDialog error texts per status and recovery (MS-SRS-074), double click on confirm, Tab and Enter (UW-FREV-024);
// EmergencyAlertPrompt Tab and Enter (UW-BRD-031); ForecastComparisonModal Tab and Escape (UW-FREV-003).
// MS-SRS-074 (CSV: popup "Lỗi khi cập nhật thẩm định: {lý do}") is out of date: the app shows the reason inside the review dialog,
// as "Không gửi được quyết định thẩm định ({lý do})" or a status sentence from forecastApi (see the tests below).

const iso = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600e3).toISOString();
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function openQueue(page, { review, role = 'admin' } = {}) {
  const items = [
    forecastItem('run-high', 'Mù Cang Chải - E2E', 'high', {
      observedRain: [{ intervalEnd: iso(2), mm: 3.5, source: 'e2e', quality: 'ok' }],
      priorRuns: [{ runId: 'run-prev', issuedAt: iso(6), hazardLevel: 'medium', probability: 0.55, reviewStatus: 'approved' }]
    }),
    forecastItem('run-medium', 'Văn Chấn - E2E', 'medium')
  ];
  const calls = await mockBackend(page, role, ({ method, path, body }) => {
    if (path === '/forecasts/review-queue') return items;
    const m = path.match(/^\/forecasts\/(.+)\/review$/);
    if (m && method === 'PATCH') {
      const out = review?.(body, m[1]);
      if (out) return out;
      items.find((i) => i.runId === m[1]).reviewStatus = body.decision;
      return {};
    }
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Chờ duyệt \(2\)/ })).toBeVisible();
  return { calls, card: (name) => page.locator('.event-card', { hasText: name }) };
}
const patches = (calls) => calls.filter((c) => c.method === 'PATCH');
const confirmApprove = (page) => page.getByRole('button', { name: 'Xác nhận phê duyệt' });
const openApprove = async (page, card, name = 'Văn Chấn - E2E') => {
  await card(name).getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(confirmApprove(page)).toBeVisible();
};
const focusedText = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return a.getAttribute('title') || a.getAttribute('aria-label') || a.getAttribute('placeholder') || a.textContent.trim();
});

// ---------- ReviewDialog: errors ----------

for (const [status, body, text] of [
  [403, {}, 'Tài khoản không có quyền thẩm định dự báo.'],
  [404, {}, 'Không tìm thấy dự báo này.'],
  [400, {}, 'Yêu cầu không hợp lệ (cần nhập lý do khi từ chối).'],
  [500, { message: 'x' }, 'Không gửi được quyết định thẩm định (Request failed with status code 500)']
]) {
  test(`MS-SRS-074 (out of date): a ${status} on the decision shows "${text}" inside the dialog; the note is kept and the button is usable again`, async ({ page }) => {
    const { calls, card } = await openQueue(page, { review: () => [status, body] });
    await openApprove(page, card);
    await page.getByPlaceholder('Ghi chú (không bắt buộc)').fill('Đã kiểm tra hiện trường');
    await confirmApprove(page).click();
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Ghi chú (không bắt buộc)')).toHaveValue('Đã kiểm tra hiện trường');
    await expect(confirmApprove(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Hủy' })).toBeEnabled();
    expect(patches(calls).map((c) => c.body)).toEqual([{ decision: 'approved', reasonNotes: 'Đã kiểm tra hiện trường' }]);
    await expect(page.getByRole('button', { name: /Chờ duyệt \(2\)/ })).toBeVisible(); // nothing changed in the queue
  });
}

test('MS-SRS-074 (out of date): a network failure shows the reason text in the dialog, and sending again after the network is back approves the proposal', async ({ page }) => {
  let down = true;
  const { calls, card } = await openQueue(page);
  await page.route('**/api/v1/forecasts/run-medium/review', (route) => (down
    ? route.abort('connectionrefused')
    : route.fallback()));
  await openApprove(page, card);
  await confirmApprove(page).click();
  await expect(page.getByText('Không gửi được quyết định thẩm định (Network Error)', { exact: true })).toBeVisible();
  down = false;
  await confirmApprove(page).click();
  await expect(page.getByRole('button', { name: /Đã duyệt \(1\)/ })).toBeVisible();
  await expect(confirmApprove(page)).toHaveCount(0); // dialog closed
  expect(patches(calls)).toHaveLength(1); // the aborted request never reached the handler
});

test('a 401 on the decision sends the user to the login page', async ({ page }) => {
  const { card } = await openQueue(page, { review: () => [401, {}] });
  await openApprove(page, card);
  await confirmApprove(page).click();
  await expect(page).toHaveURL(/\/login/);
});

test('the error is cleared by Hủy: opening the dialog for the same proposal again starts with no message and the note empty', async ({ page }) => {
  const { card } = await openQueue(page, { review: () => [403, {}] });
  await openApprove(page, card);
  await page.getByPlaceholder('Ghi chú (không bắt buộc)').fill('ghi chú cũ');
  await confirmApprove(page).click();
  await expect(page.getByText('Tài khoản không có quyền thẩm định dự báo.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy' }).click();
  await expect(confirmApprove(page)).toHaveCount(0);
  await openApprove(page, card);
  await expect(page.getByText('Tài khoản không có quyền thẩm định dự báo.', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Ghi chú (không bắt buộc)')).toHaveValue('');
});

test('while the decision is in flight the button says "Đang gửi..." and Hủy is disabled; a double click on confirm sends one PATCH', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { card } = await openQueue(page);
  const sent = [];
  page.on('request', (r) => { if (r.method() === 'PATCH') sent.push(r.postData()); });
  await page.route('**/api/v1/forecasts/run-medium/review', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    await gate;
    await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: '{}' });
  });
  await openApprove(page, card);
  await confirmApprove(page).dblclick();
  await expect(page.getByRole('button', { name: 'Đang gửi...' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Hủy' })).toBeDisabled();
  release();
  await expect(page.getByRole('button', { name: 'Đang gửi...' })).toHaveCount(0); // the dialog closed
  await expect(confirmApprove(page)).toHaveCount(0);
  expect(sent).toEqual(['{"decision":"approved","reasonNotes":null}']);
});

// ---------- ReviewDialog: keyboard (UW-FREV-024) ----------

test('UW-FREV-024: from the note field Tab reaches Hủy then the confirm button, and Enter on the confirm button sends the decision', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await openApprove(page, card);
  await page.getByPlaceholder('Ghi chú (không bắt buộc)').focus();
  await page.keyboard.press('Tab');
  expect(await focusedText(page)).toBe('Hủy');
  await page.keyboard.press('Tab');
  expect(await focusedText(page)).toBe('Xác nhận phê duyệt');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Đã duyệt \(1\)/ })).toBeVisible();
  expect(patches(calls).map((c) => c.body)).toEqual([{ decision: 'approved', reasonNotes: null }]);
});

test('UW-FREV-024: for a rejection the confirm button is skipped by Tab until a reason is typed, then Enter sends it', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await card('Văn Chấn - E2E').getByRole('button', { name: 'Từ chối' }).click();
  const reason = page.getByPlaceholder('Lý do từ chối (bắt buộc)');
  await reason.focus();
  await page.keyboard.press('Tab');
  expect(await focusedText(page)).toBe('Hủy');
  await page.keyboard.press('Tab'); // the confirm button is disabled: not a tab stop
  expect(await focusedText(page)).not.toBe('Xác nhận từ chối');
  await reason.fill('Không khớp mưa thực đo');
  await page.getByRole('button', { name: 'Hủy' }).focus();
  await page.keyboard.press('Tab');
  expect(await focusedText(page)).toBe('Xác nhận từ chối');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Từ chối \(1\)/ })).toBeVisible();
  expect(patches(calls).map((c) => c.body)).toEqual([{ decision: 'rejected', reasonNotes: 'Không khớp mưa thực đo' }]);
});

// ponytail: in ReviewDialog move focus to the note field on open and trap Tab inside (role="dialog", aria-modal, a focus loop); until then focus stays on the card behind.
test.fixme('UW-FREV-024: opening the review dialog moves focus into it, and Tab does not leave it', async ({ page }) => {
  // BUG: expected focus inside the dialog after it opens and Tab cycling among its controls; actual: focus stays on the "Phê duyệt" button of the card
  // behind the overlay, and Tab from the last dialog button goes on to the page behind it (the dialog has no role and no focus trap).
  const { card } = await openQueue(page);
  await openApprove(page, card);
  const inDialog = () => page.evaluate(() => !!document.activeElement.closest('textarea, [data-dialog], [role="dialog"]')
    || ['Hủy', 'Xác nhận phê duyệt'].includes(document.activeElement.textContent.trim()));
  expect(await inDialog()).toBe(true);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await inDialog()).toBe(true);
  }
});

// ---------- EmergencyAlertPrompt: keyboard (UW-BRD-031) ----------

const prompt = (page) => page.locator('.alert-prompt-wrapper');
async function approveHigh(page, card) {
  await openApprove(page, card, 'Mù Cang Chải - E2E');
  await confirmApprove(page).click();
  await expect(prompt(page)).toContainText('Đã phê duyệt — Nguy cơ HIGH');
}

test('UW-BRD-031: in the admin prompt Tab goes from "Soạn cảnh báo" to "Đóng", and Enter on "Đóng" closes it without opening the send form', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await approveHigh(page, card);
  await prompt(page).getByRole('button', { name: 'Soạn cảnh báo' }).focus();
  await page.keyboard.press('Tab');
  await expect(prompt(page).getByTitle('Đóng')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});

test('UW-BRD-031: Enter on "Soạn cảnh báo" closes the prompt and opens the send form, still sending nothing', async ({ page }) => {
  const { calls, card } = await openQueue(page);
  await approveHigh(page, card);
  await prompt(page).getByRole('button', { name: 'Soạn cảnh báo' }).focus();
  await page.keyboard.press('Enter');
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('PHÁT LỆNH CẢNH BÁO THIÊN TAI KHẨN CẤP');
  expect(calls.filter((c) => c.method === 'POST')).toEqual([]);
});

test('UW-BRD-031: the officer prompt has one tab stop, "Đóng", and Enter on it closes the prompt', async ({ page }) => {
  const { card } = await openQueue(page, { role: 'officer' });
  await approveHigh(page, card);
  await expect(prompt(page).getByRole('button')).toHaveCount(1);
  await prompt(page).getByTitle('Đóng').focus();
  await page.keyboard.press('Enter');
  await expect(prompt(page)).toHaveCount(0);
});

// ---------- ForecastComparisonModal: keyboard (UW-FREV-003) ----------

const CMP = 'SO SÁNH CÁC LẦN DỰ BÁO THEO THỜI GIAN';
async function openComparison(page, card) {
  await card('Mù Cang Chải - E2E').click();
  await page.getByRole('button', { name: 'Chi tiết tiến trình' }).click();
  await expect(page.getByRole('heading', { name: CMP })).toBeVisible();
  return page.locator('body > div', { has: page.getByRole('heading', { name: CMP }) });
}

test('UW-FREV-003: the close button is reachable by Tab and Enter on it closes the dialog', async ({ page }) => {
  const { card } = await openQueue(page);
  const dlg = await openComparison(page, card);
  const close = dlg.getByRole('button');
  await expect(close).toHaveCount(1); // the only control of the dialog
  await page.keyboard.press('Tab'); // from the "Chi tiết tiến trình" button that opened it
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: CMP })).toHaveCount(0);
});

// ponytail: in ForecastComparisonModal add an Escape handler (DashboardPage's DIALOG_ORDER does not know this dialog; it is opened from RainfallEvidencePanel).
test.fixme('UW-FREV-003: Escape closes the comparison dialog', async ({ page }) => {
  // BUG: expected Escape to close the dialog like the other dialogs; actual: Escape does nothing.
  const { card } = await openQueue(page);
  await openComparison(page, card);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: CMP })).toHaveCount(0);
});

// ponytail: add aria-label="Đóng" to the icon-only close button of ForecastComparisonModal.
test.fixme('UW-FREV-003: the close button of the comparison dialog has an accessible name', async ({ page }) => {
  // BUG: expected the close button to be found by name; actual: an icon-only button without text or aria-label, read as just "button".
  const { card } = await openQueue(page);
  const dlg = await openComparison(page, card);
  await expect(dlg.getByRole('button', { name: /Đóng/ })).toBeVisible();
});

test.fixme('UW-FREV-003: Tab does not leave the comparison dialog for the page behind it', async ({ page }) => {
  // BUG: expected focus to stay among the dialog controls (it is a full-screen overlay); actual: Tab 1 reaches the close button, Tab 2 leaves the dialog
  // (focus goes to <body>) and further Tabs walk the page behind it, so a keyboard user works on controls they cannot see.
  const { card } = await openQueue(page);
  const dlg = await openComparison(page, card);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(await dlg.evaluate((el) => el.contains(document.activeElement))).toBe(true);
});
