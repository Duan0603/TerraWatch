import { test, expect } from '@playwright/test';
import { mockBackend, forecastItem } from './helpers.js';

// Mocked API. Typical display of the dashboard's small parts that no other spec reads value by value:
// the KPI strip (UW-DASH-040), the proposal card (UW-DASH-035), the top bar brand and connection tooltip (UW-DASH-096),
// the step bar and OTP boxes of the forgot-password panel (UW-AUTH-025, UW-AUTH-035) and the login backdrop (UW-AUTH-030).
// Already asserted elsewhere (see the PR body): MobileTabBar UW-DASH-072, NavMenu UW-DASH-091 and AdminMenu UW-DASH-013 (navbar.spec.js, rolemenu.spec.js),
// LocationSelector UW-DASH-057 (locationselector.spec.js), RainfallEvidencePanel UW-DASH-101 (rainfallevidence.spec.js), ModelDemoPage UW-MAP-001 (modeldemo.spec.js).

const hours = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const unit = (extra = {}) => ({ ...forecastItem('x', 'x', 'low').unit, ...extra });

// ---------- KPI strip ----------

const QUEUE = () => [
  forecastItem('run-a', 'A - high pending', 'high'), // live, pending, high
  forecastItem('run-b', 'B - extreme soon', 'extreme', { reviewStatus: 'approved', validUntil: hours(3) }), // live, expires in 3 h
  forecastItem('run-c', 'C - medium', 'medium'),
  forecastItem('run-d', 'D - rejected', 'high', { reviewStatus: 'rejected' }), // live but rejected: not a risk any more
  forecastItem('run-e', 'E - expired', 'high', { expired: true, validUntil: hours(-2) }),
  forecastItem('run-f', 'F - no forecast', 'high', { availability: 'unavailable', hazardLevel: null, probability: null })
];
const REPORTS = [
  { report_id: 1, status: 'submitted', longitude: 104.2, latitude: 21.9, description: 'a', observed_at: '2026-10-10T03:00:00Z' },
  { report_id: 2, status: 'submitted', longitude: 104.3, latitude: 21.8, description: 'b', observed_at: '2026-10-10T03:00:00Z' },
  { report_id: 3, status: 'processed', longitude: 104.4, latitude: 21.7, description: 'c', observed_at: '2026-10-10T03:00:00Z' }
];
const bc = (id, hoursAgo, extra = {}) => ({ broadcastId: id, sentAt: new Date(Date.now() - hoursAgo * 3600e3).toISOString(), areaId: 1, areaName: 'Khu A', runId: 'run-a', recipients: 5, sent: 5, failed: 0, status: 'active', message: 'm', senderName: 'Admin', severity: 'high', ...extra });
const kpi = (page, label) => page.locator('.kpi-card', { has: page.locator('.kpi-label', { hasText: new RegExp(`^${label}$`) }) });

async function openDashboard(page, role, { queue = QUEUE(), reports = REPORTS, broadcasts = [] } = {}) {
  const calls = await mockBackend(page, role, ({ path }) => {
    if (path === '/forecasts/review-queue') return queue;
    if (path === '/community-reports') return reports;
    if (path === '/notifications/broadcasts') return broadcasts;
    if (path === '/forecasts/reviews/metrics') return [404, {}]; // no review card: keeps the strip to the five counters (+ broadcasts)
  });
  await page.goto('/');
  await expect(page.locator('.event-card').first()).toBeVisible();
  return calls;
}

test('UW-DASH-040: the strip counts units, pending, high risk, expiring soon and new field reports from the data, with the sub-lines and colours', async ({ page }) => {
  await openDashboard(page, 'officer');
  const strip = page.getByLabel('Tổng quan tình hình');
  await expect(strip.locator('.kpi-label')).toHaveText(['Ô đánh giá', 'Chờ thẩm định', 'Nguy cơ cao', 'Sắp hết hạn', 'Báo cáo hiện trường mới']); // no broadcast card for an officer
  await expect(kpi(page, 'Ô đánh giá').locator('.kpi-value')).toHaveText('6');
  await expect(kpi(page, 'Ô đánh giá')).toContainText('6 lần dự báo · 4 còn hiệu lực');
  await expect(kpi(page, 'Chờ thẩm định').locator('.kpi-value')).toHaveText('3'); // A, C and F; the expired one is not counted
  await expect(kpi(page, 'Chờ thẩm định')).toContainText('cần cán bộ xử lý');
  await expect(kpi(page, 'Chờ thẩm định')).toHaveClass(/kpi-warn/);
  await expect(kpi(page, 'Nguy cơ cao').locator('.kpi-value')).toHaveText('2'); // A (high) + B (extreme); rejected, expired and no-forecast are left out
  await expect(kpi(page, 'Nguy cơ cao')).toContainText('1 cực nguy hiểm · 1 cao');
  await expect(kpi(page, 'Nguy cơ cao')).toHaveClass(/kpi-danger/);
  await expect(kpi(page, 'Sắp hết hạn').locator('.kpi-value')).toHaveText('1'); // only B ends within 6 h
  await expect(kpi(page, 'Sắp hết hạn')).toContainText('trong 6 giờ tới');
  await expect(kpi(page, 'Báo cáo hiện trường mới').locator('.kpi-value')).toHaveText('2'); // the processed one is not new
  await expect(kpi(page, 'Báo cáo hiện trường mới')).toContainText('chưa xử lý');
});

test('UW-DASH-040: the admin strip adds the broadcast card: only the last 24 h, revoked ones left out, with the delivered devices', async ({ page }) => {
  await openDashboard(page, 'admin', { broadcasts: [bc('b1111111-0000', 1, { sent: 5 }), bc('b2222222-0000', 2, { status: 'revoked', sent: 3 }), bc('b3333333-0000', 30, { sent: 9 })] });
  const card = kpi(page, 'Cảnh báo đã phát 24h');
  await expect(card.locator('.kpi-value')).toHaveText('1');
  await expect(card).toContainText('5 thiết bị đã nhận');
  await expect(card).toHaveClass(/kpi-neutral/);
});

test('UW-DASH-040: with an empty queue and no reports every counter is 0 and says there is nothing to do, in the calm colour', async ({ page }) => {
  await mockBackend(page, 'officer', ({ path }) => (path === '/forecasts/reviews/metrics' ? [404, {}] : undefined));
  await page.goto('/');
  const strip = page.getByLabel('Tổng quan tình hình');
  await expect(kpi(page, 'Ô đánh giá').locator('.kpi-value')).toHaveText('0');
  await expect(kpi(page, 'Ô đánh giá')).toContainText('0 lần dự báo · 0 còn hiệu lực');
  await expect(kpi(page, 'Chờ thẩm định')).toContainText('đã xử lý hết');
  for (const label of ['Chờ thẩm định', 'Nguy cơ cao', 'Sắp hết hạn', 'Báo cáo hiện trường mới']) {
    await expect(kpi(page, label).locator('.kpi-value')).toHaveText('0');
    await expect(kpi(page, label)).toHaveClass(/kpi-ok/);
  }
  await expect(kpi(page, 'Nguy cơ cao')).toContainText('0 cực nguy hiểm · 0 cao');
  await expect(strip).not.toContainText('NaN');
});

// ---------- proposal card ----------

test('UW-DASH-035: a proposal card shows risk, status, place, coordinates, the three metrics and the model; a missing value is a dash, not NaN', async ({ page }) => {
  await openDashboard(page, 'officer', {
    queue: [
      forecastItem('run-1', 'Mù Cang Chải - E2E', 'extreme', { probability: 0.627, modelVersion: 'gru-e2e' }),
      forecastItem('run-2', 'Thiếu số - E2E', 'low', { probability: null, unit: unit({ name: 'Thiếu số - E2E', slopeAvg: null, elevationAvg: null }) })
    ]
  });
  await page.getByRole('button', { name: /Tất cả/ }).click();
  const full = page.locator('.event-card', { hasText: 'Mù Cang Chải - E2E' });
  await expect(full.locator('.risk-tag')).toHaveText('Cực nguy hiểm');
  await expect(full.locator('.event-status')).toHaveText('● Chờ thẩm định');
  await expect(full.locator('.event-location')).toHaveText('Mù Cang Chải - E2E');
  await expect(full.locator('.event-coords')).toHaveText('21.700°N, 104.500°E');
  await expect(full.locator('.grid-metrics')).toContainText('Điểm thử nghiệm: 63%'); // 0.627 rounded
  await expect(full.locator('.grid-metrics')).toContainText('Độ dốc TB: 24.5°');
  await expect(full.locator('.grid-metrics')).toContainText('Độ cao TB: 800 m');
  await expect(full.locator('.grid-metrics')).toContainText('Mô hình: gru-e2e');
  await expect(full).toContainText(/Hiệu lực: còn \d+ giờ \d+ phút/);
  await expect(full.getByRole('button', { name: 'Phê duyệt' })).toBeVisible();
  await expect(full.getByRole('button', { name: 'Từ chối' })).toBeVisible();

  const dash = page.locator('.event-card', { hasText: 'Thiếu số - E2E' });
  await expect(dash.locator('.risk-tag')).toHaveText('Thấp');
  await expect(dash.locator('.grid-metrics')).toContainText('Điểm thử nghiệm: —');
  await expect(dash.locator('.grid-metrics')).toContainText('Độ dốc TB: —');
  await expect(dash.locator('.grid-metrics')).toContainText('Độ cao TB: —');
  await expect(dash).not.toContainText('NaN');
});

test('UW-DASH-035: every risk level has its Vietnamese label, and a card without a forecast says so instead of a level', async ({ page }) => {
  await openDashboard(page, 'officer', {
    queue: [
      forecastItem('r-ex', 'Cực - E2E', 'extreme'), forecastItem('r-hi', 'Cao - E2E', 'high'),
      forecastItem('r-me', 'Vừa - E2E', 'medium'), forecastItem('r-lo', 'Thấp - E2E', 'low'),
      forecastItem('r-un', 'Không - E2E', 'high', { availability: 'unavailable', hazardLevel: null, probability: null })
    ]
  });
  await page.getByRole('button', { name: /Tất cả/ }).click();
  const tag = (name) => page.locator('.event-card', { hasText: name }).locator('.risk-tag');
  await expect(tag('Cực - E2E')).toHaveText('Cực nguy hiểm');
  await expect(tag('Cao - E2E')).toHaveText('Cao');
  await expect(tag('Vừa - E2E')).toHaveText('Trung bình');
  await expect(tag('Thấp - E2E')).toHaveText('Thấp');
  await expect(tag('Không - E2E')).toHaveText('Không có dự báo');
  await expect(tag('Cực - E2E')).toHaveClass(/extreme/);
  await expect(tag('Không - E2E')).toHaveClass(/unavailable/);
});

test('UW-DASH-035: pressing Phê duyệt on a card opens the dialog for that card without selecting it', async ({ page }) => {
  await openDashboard(page, 'officer', { queue: [forecastItem('run-1', 'Một - E2E', 'high'), forecastItem('run-2', 'Hai - E2E', 'high')] });
  const first = page.locator('.event-card', { hasText: 'Một - E2E' });
  const second = page.locator('.event-card', { hasText: 'Hai - E2E' });
  await expect(first).toHaveClass(/selected/); // the first card is selected on load
  await second.getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(page.getByText(/Hai - E2E — việc duyệt chỉ xác nhận/)).toBeVisible();
  await expect(first).toHaveClass(/selected/); // the button stops the click from reaching the card
  await expect(second).not.toHaveClass(/selected/);
});

// ---------- top bar ----------

test('UW-DASH-096: the top bar shows the brand, the connection tooltip says when the queue was last loaded', async ({ page }) => {
  await openDashboard(page, 'admin');
  await expect(page.locator('.nav-brand-name')).toHaveText('TerraWatch');
  await expect(page.locator('.nav-brand-sub')).toHaveText('GeoSentry Platform');
  await expect(page.locator('.status-chip')).toHaveAttribute('title', /^Lần tải cuối: \d{2}:\d{2} \d{2}\/\d{2}\/\d{4} \(UTC\+7\) · (cập nhật mỗi phút|nhận cập nhật tức thì từ máy chủ)$/);
});

// ---------- login: step bar, OTP boxes, backdrop ----------

async function openForgot(page) {
  const calls = await mockBackend(page, null, ({ path }) => {
    if (path.endsWith('/email/verify')) return { resetToken: 'tok-e2e' };
  });
  await page.goto('/login');
  await page.locator('#lg-email').fill('quen@e2e.test');
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  return calls;
}

test('UW-AUTH-025: the reset step bar names the four steps and moves the current mark and the done ticks as the user goes on', async ({ page }) => {
  await openForgot(page);
  const steps = page.getByLabel('Các bước đặt lại mật khẩu');
  const state = () => steps.locator('li').evaluateAll((lis) => lis.map((li) => [li.querySelector('.lg-step-label').textContent, li.className.replace('lg-step ', ''), li.getAttribute('aria-current')]));
  expect(await state()).toEqual([['Tài khoản', 'lg-step-now', 'step'], ['Mã OTP', 'lg-step-todo', null], ['Mật khẩu mới', 'lg-step-todo', null], ['Hoàn tất', 'lg-step-todo', null]]);
  await page.getByRole('button', { name: 'Gửi mã qua email' }).click();
  await expect(page.getByText('Nhập mã vào các ô dưới đây.', { exact: false })).toBeVisible();
  expect(await state()).toEqual([['Tài khoản', 'lg-step-done', null], ['Mã OTP', 'lg-step-now', 'step'], ['Mật khẩu mới', 'lg-step-todo', null], ['Hoàn tất', 'lg-step-todo', null]]);
  await expect(steps.locator('.lg-step-done svg')).toHaveCount(1); // a done step shows a tick instead of its number
  await expect(steps.locator('.lg-step-todo .lg-step-dot')).toHaveText(['3', '4']);
  await page.getByLabel('Chữ số 1').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Xác nhận mã OTP' }).click();
  await expect(page.locator('#fp-pw')).toBeVisible();
  expect(await state()).toEqual([['Tài khoản', 'lg-step-done', null], ['Mã OTP', 'lg-step-done', null], ['Mật khẩu mới', 'lg-step-now', 'step'], ['Hoàn tất', 'lg-step-todo', null]]);
});

test('UW-AUTH-035: the OTP group has six numeric one-time-code boxes with their own labels; the first has focus and the arrow keys move between boxes', async ({ page }) => {
  await openForgot(page);
  await page.getByRole('button', { name: 'Gửi mã qua email' }).click();
  const group = page.getByRole('group', { name: 'Mã OTP gồm 6 chữ số' });
  await expect(group.locator('input')).toHaveCount(6);
  for (let i = 1; i <= 6; i += 1) {
    await expect(group.getByLabel(`Chữ số ${i}`)).toHaveAttribute('inputmode', 'numeric');
    await expect(group.getByLabel(`Chữ số ${i}`)).toHaveValue('');
  }
  await expect(group.getByLabel('Chữ số 1')).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(group.getByLabel('Chữ số 2')).toHaveAttribute('autocomplete', 'off');
  await expect(group.getByLabel('Chữ số 1')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(group.getByLabel('Chữ số 2')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(group.getByLabel('Chữ số 2')).toBeFocused();
  await page.getByLabel('Chữ số 1').focus();
  await page.keyboard.press('ArrowLeft'); // the first box has nothing to the left: focus stays
  await expect(group.getByLabel('Chữ số 1')).toBeFocused();
});

test('UW-AUTH-030: the login backdrop is hidden from assistive technology, does not take clicks, and draws the rain on its canvas', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mockBackend(page, null, () => undefined);
  await page.goto('/login');
  const backdrop = page.locator('.lg-backdrop');
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true');
  await expect(backdrop).toHaveCSS('pointer-events', 'none');
  await expect(page.getByRole('img')).toHaveCount(0); // decoration only: nothing is announced
  // the rain is drawn: after a few frames the canvas is no longer fully transparent
  await expect.poll(() => page.locator('canvas.lg-rain').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  })).toBe(true);
  await page.locator('#lg-email').fill('a@e2e.test'); // the form above it stays usable
  await expect(page.locator('#lg-email')).toHaveValue('a@e2e.test');
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('UW-AUTH-030: with "reduce motion" on, the canvas stays empty (no rain, no lightning) and the page still works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mockBackend(page, null, () => undefined);
    await page.goto('/login');
    await expect(page.locator('.lg-backdrop')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
    const drawn = await page.locator('canvas.lg-rain').evaluate((c) => {
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, Math.max(c.width, 1), Math.max(c.height, 1)).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
      return false;
    });
    expect(drawn).toBe(false);
    expect(errors).toEqual([]);
  });
});
