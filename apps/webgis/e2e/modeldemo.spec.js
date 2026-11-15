import { test, expect } from '@playwright/test';
import { mockBackend } from './helpers.js';

// Public page /model-demo: replays pre-computed model scores from static files under /model-demo/ (no API, no login).
// The files are replaced by small fixtures so counts and scores are known. Cells are picked in the offline grid view,
// because the base map needs tiles from the internet (blocked in tests).
// Not covered: clicking cells on the real map canvas (needs WebGL and tiles).

const cell = (x, y, hazard, mapped) => ({
  type: 'Feature',
  id: `UTM48N_1km_${x}_${y}`,
  properties: {
    unit_id: `UTM48N_1km_${x}_${y}`, target_local_date: '2020-10-18', p_hazard_slope_soil: hazard, p_temporal_gru: 0.5, p_spatial_12dist_slope_soil: Math.min(1, hazard / 0.5),
    mapped_proxy_label: mapped, slope_deg: 15.26, clay_pct: 31.2, sand_pct: 36.1, bulk_density_g_cm3: 1.15, rain_past_24h_mm: 12.5, rain_past_168h_mm: 80, forecast_24h_mm: 40,
    history_24h_totals: [0, 1, 2, 3, 4, 5, 6]
  },
  geometry: { type: 'Polygon', coordinates: [[[106.5, 16.7], [106.51, 16.7], [106.51, 16.71], [106.5, 16.71], [106.5, 16.7]]] }
});
const fc = (features) => ({ type: 'FeatureCollection', features });
// 4 cells: score 0.8 mapped (TP at 0.5), 0.3 mapped (FN), 0.6 not mapped (FP), 0.1 not mapped (TN)
const MAIN = fc([cell(665000, 1850000, 0.8, 1), cell(665000, 1851000, 0.3, 1), cell(666000, 1850000, 0.6, 0), cell(666000, 1851000, 0.1, 0)]);
const BIG = fc(Array.from({ length: 35 }, (_, i) => cell(700000 + i * 1000, 1850000, 0.9 - i * 0.02, 0)));
const INDEX = {
  version: 1, defaultScenario: 'a_event',
  scenarios: [
    { id: 'a_event', district: 'Hướng Hóa', date: '2020-10-18', eventDay: true, split: 'test', cells: 4, url: 'a_event.geojson' },
    { id: 'a_base', district: 'Hướng Hóa', date: '2020-05-15', eventDay: false, split: 'validation', cells: 4, url: 'a_base.geojson' },
    { id: 'b_event', district: 'Phong Điền', date: '2020-10-12', eventDay: true, split: 'test', cells: 35, url: 'b_event.geojson' },
    { id: 'c_event', district: 'Nha Trang', date: '2018-11-09', eventDay: true, split: 'test', cells: 0, url: 'c_event.geojson' }
  ]
};
const FILES = { 'index.json': INDEX, 'a_event.geojson': MAIN, 'a_base.geojson': MAIN, 'b_event.geojson': BIG, 'c_event.geojson': fc([]) };

async function openDemo(page, { override = {}, role = null, url = '/model-demo' } = {}) {
  const calls = await mockBackend(page, role, () => undefined);
  const fetched = [];
  await page.route('**/model-demo/*', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    fetched.push(name);
    const o = override[name];
    if (typeof o === 'function') return o(route);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FILES[name]) });
  });
  await page.goto(url);
  return { calls, fetched };
}
const stats = (page) => page.locator('.model-scenario-stats');
const rows = (page) => page.locator('button.model-cell-row');
const detail = (page) => page.getByLabel('Chi tiết ô đã chọn');
async function grid(page) {
  await page.getByRole('button', { name: 'Lưới ngoại tuyến' }).click();
  return page.getByLabel('Sơ đồ các ô thật trên lưới UTM 1 km, không có nền bản đồ');
}

test('loads the index and the default scenario; shows scenario info, stats at 0.50 and the research-only notice', async ({ page }) => {
  const { fetched, calls } = await openDemo(page);
  await expect(page.getByRole('heading', { name: 'Demo mô hình sạt lở' })).toBeVisible();
  await expect(page.getByText('Mô hình nghiên cứu, chưa dùng để cảnh báo thực tế. Điểm nguy cơ không phải xác suất sạt lở.')).toBeVisible();
  await expect(page.getByLabel('Khu vực')).toHaveValue('Hướng Hóa');
  await expect(page.getByLabel('Ngày mục tiêu · giờ Việt Nam')).toHaveValue('a_event');
  await expect(page.getByText('Tập test · 4 ô · 00:00–24:00')).toBeVisible();
  await expect(rows(page)).toHaveCount(4);

  await expect(stats(page)).toContainText('Ô vượt ngưỡng2 / 4');
  await expect(stats(page)).toContainText('Khớp ô dương proxy1 / 2');
  await expect(stats(page)).toContainText('Ô nền bị báo dương1');
  await expect(stats(page)).toContainText('Precision / Recall50.0% / 50.0%');
  expect([...new Set(fetched)]).toEqual(['index.json', 'a_event.geojson']); // index first (dev builds may ask twice), then the default scenario only
  expect(calls).toEqual([]); // never talks to the API
});

test("district select lists the districts; the date select lists that district's days, marking the source event day", async ({ page }) => {
  await openDemo(page);
  await expect(rows(page)).toHaveCount(4);
  expect(await page.getByLabel('Khu vực').locator('option').allTextContents()).toEqual(['Hướng Hóa', 'Phong Điền', 'Nha Trang']);
  expect(await page.getByLabel('Ngày mục tiêu · giờ Việt Nam').locator('option').allTextContents())
    .toEqual(['18/10/2020 · Ngày sự kiện nguồn', '15/05/2020 · Ngày nền chọn mẫu']);
  await page.getByLabel('Ngày mục tiêu · giờ Việt Nam').selectOption('a_base');
  await expect(page.getByText('Tập validation · 4 ô · 00:00–24:00')).toBeVisible();
});

test('changing the district loads its event-day scenario; the list and the search are reset', async ({ page }) => {
  const { fetched } = await openDemo(page);
  await page.getByLabel('Tìm theo mã ô').fill('665000');
  await page.getByLabel('Khu vực').selectOption('Phong Điền');
  await expect(page.getByLabel('Ngày mục tiêu · giờ Việt Nam')).toHaveValue('b_event');
  await expect(page.getByText('Tập test · 35 ô')).toBeVisible();
  await expect(page.getByLabel('Tìm theo mã ô')).toHaveValue('');
  await expect(page.locator('.model-cell-list-heading span')).toHaveText('35');
  expect(fetched).toContain('b_event.geojson');
});

test('the highest-scoring cell is selected first and its detail shows scores, inputs and the 7-day rain', async ({ page }) => {
  await openDemo(page);
  await expect(detail(page)).toContainText('UTM48N_1km_665000_1850000');
  await expect(detail(page).getByLabel('Điểm hai nhánh và điểm nguy cơ')).toContainText('0.500Mưa · GRU×1.000Địa hình · đất=0.800Điểm nguy cơ');
  await expect(detail(page)).toContainText('Vượt ngưỡng thử 0.50 · Ô có điểm trong kiểm kê');
  // inputs use the vi-VN decimal comma and one decimal (1.15 reads 1,2); the scores above use a point and three decimals
  const inputs = ['Độ dốc15,3 °', 'Tỷ lệ sét31,2 %', 'Tỷ lệ cát36,1 %', 'Khối lượng thể tích1,2 g/cm³', 'Mưa 24 giờ trước12,5 mm', 'Mưa 168 giờ trước80 mm', 'GFS 24 giờ mục tiêu40 mm'];
  for (const text of inputs) {
    await expect(detail(page)).toContainText(text);
  }
  await expect(detail(page).getByRole('img', { name: 'Mưa trong bảy khoảng 24 giờ: 0, 1, 2, 3, 4, 5, 6 milimét' })).toBeVisible();
  await expect(rows(page).first()).toHaveAttribute('aria-pressed', 'true');
});

test('the list is sorted by score, labels proxy cells, and a click selects a cell and updates the detail', async ({ page }) => {
  await openDemo(page);
  await expect(rows(page).nth(0)).toContainText('665000_1850000');
  await expect(rows(page).nth(0)).toContainText('0.800');
  await expect(rows(page).nth(0)).toContainText('Có điểm kiểm kê');
  await expect(rows(page).nth(1)).toContainText('666000_1850000'); // 0.6
  await expect(rows(page).nth(1)).toContainText('Nền proxy');
  await expect(rows(page).nth(3)).toContainText('666000_1851000'); // 0.1

  await rows(page).nth(1).click();
  await expect(rows(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(rows(page).nth(0)).toHaveAttribute('aria-pressed', 'false');
  await expect(detail(page)).toContainText('UTM48N_1km_666000_1850000');
  await expect(detail(page)).toContainText('Vượt ngưỡng thử 0.50 · Ô nền proxy, chưa xác minh không sạt lở');
});

test('search filters the list by cell code and says when nothing matches', async ({ page }) => {
  await openDemo(page);
  await page.getByLabel('Tìm theo mã ô').fill('666000_185');
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('.model-cell-list-heading span')).toHaveText('2');
  await page.getByLabel('Tìm theo mã ô').fill('khong-co');
  await expect(page.getByText('Không có ô khớp mã tìm kiếm.')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test('the list shows 30 cells first and "Xem thêm 30 ô" shows the rest', async ({ page }) => {
  await openDemo(page);
  await page.getByLabel('Khu vực').selectOption('Phong Điền');
  await expect(rows(page)).toHaveCount(30);
  await page.getByRole('button', { name: 'Xem thêm 30 ô' }).click();
  await expect(rows(page)).toHaveCount(35);
  await expect(page.getByRole('button', { name: 'Xem thêm 30 ô' })).toHaveCount(0);
});

test('threshold: presets and the slider recompute the stats and the detail wording', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '0.26', exact: true }).click();
  await expect(page.getByRole('button', { name: '0.26', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('output')).toHaveText('0.26');
  await expect(stats(page)).toContainText('Ô vượt ngưỡng3 / 4');
  await expect(stats(page)).toContainText('Khớp ô dương proxy2 / 2');
  await expect(stats(page)).toContainText('Precision / Recall66.7% / 100.0%');

  await page.getByRole('button', { name: '0.65', exact: true }).click();
  await expect(stats(page)).toContainText('Ô vượt ngưỡng1 / 4');
  await expect(stats(page)).toContainText('Ô nền bị báo dương0');

  await page.getByLabel('Ngưỡng thử nghiệm').fill('0.9'); // above every score
  await expect(page.locator('output')).toHaveText('0.90');
  await expect(stats(page)).toContainText('Ô vượt ngưỡng0 / 4');
  await expect(stats(page)).toContainText('Precision / Recall—'); // nothing flagged: precision undefined
  await expect(detail(page)).toContainText('Dưới ngưỡng thử 0.90');
});

test('offline grid view draws one clickable cell per row; picking one selects it everywhere; Bản đồ switches back', async ({ page }) => {
  await openDemo(page);
  const svg = await grid(page);
  await expect(page.getByText('Sơ đồ ô UTM 1 km, không có nền bản đồ.')).toBeVisible();
  await expect(svg.getByRole('button')).toHaveCount(4);
  await svg.getByRole('button', { name: 'Chọn UTM48N_1km_666000_1851000, điểm 0.100' }).click();
  await expect(detail(page)).toContainText('UTM48N_1km_666000_1851000');
  await expect(rows(page).nth(3)).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Bản đồ', exact: true }).click();
  await expect(page.locator('.model-map-canvas')).toBeVisible();
  await expect(svg).toHaveCount(0);
});

test('"Làm mờ ô dưới ngưỡng" and "Đối chiếu ô có điểm kiểm kê" change how the grid draws cells', async ({ page }) => {
  await openDemo(page);
  const svg = await grid(page);
  const rect = (id) => svg.getByRole('button', { name: new RegExp(`^Chọn UTM48N_1km_${id},`) }).locator('rect');
  await expect(rect('666000_1851000')).toHaveAttribute('opacity', '0.78');
  await page.getByLabel('Làm mờ ô dưới ngưỡng').check();
  await expect(rect('666000_1851000')).toHaveAttribute('opacity', '0.12'); // 0.1 < 0.5
  await expect(rect('665000_1850000')).toHaveAttribute('opacity', '0.78'); // 0.8 >= 0.5

  await expect(rect('665000_1851000')).toHaveAttribute('stroke', '#142c42'); // mapped cell outlined
  await page.getByLabel('Đối chiếu ô có điểm kiểm kê').uncheck();
  await expect(rect('665000_1851000')).toHaveAttribute('stroke', 'white');
});

test('"Tải kết quả đang xem" downloads a CSV of the whole scenario with the flag against the current threshold', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '0.65', exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải kết quả đang xem' }).click()]);
  expect(download.suggestedFilename()).toBe('terrawatch-replay-a_event.csv');
  const lines = (await (await import('node:fs/promises')).readFile(await download.path(), 'utf8')).trim().split('\n');
  expect(lines[0]).toBe('unit_id,target_local_date,hazard_score,temporal_score,spatial_score,mapped_proxy_label,above_experimental_threshold');
  expect(lines).toHaveLength(5);
  expect(lines.slice(1).map((l) => l.split(',').pop())).toEqual(['1', '0', '0', '0']); // only 0.8 reaches 0.65
});

test('while a scenario loads the map area shows a status; the export and the selects are disabled until it is ready', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await openDemo(page, { override: { 'a_event.geojson': async (route) => { await gate; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MAIN) }); } } });
  await expect(page.getByRole('status').filter({ hasText: 'Đang tải kịch bản lịch sử' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải kết quả đang xem' })).toBeDisabled();
  await expect(page.getByLabel('Khu vực')).toBeDisabled();
  release();
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Tải kết quả đang xem' })).toBeEnabled();
});

test('a failed index shows the error with a retry that loads it', async ({ page }) => {
  let fail = true;
  const ok = (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(INDEX) });
  await openDemo(page, { override: { 'index.json': (route) => (fail ? route.fulfill({ status: 500, body: 'x' }) : ok(route)) } });
  await expect(page.getByRole('alert')).toContainText('Chưa tải được kịch bản');
  await expect(page.getByRole('alert')).toContainText('Không tải được dữ liệu demo. Hãy thử lại hoặc kiểm tra kết nối đến web.');
  fail = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a scenario file with no cells says to pick another day', async ({ page }) => {
  await openDemo(page);
  await page.getByLabel('Khu vực').selectOption('Nha Trang');
  await expect(page.getByRole('alert')).toContainText('Kịch bản chưa có ô dữ liệu. Hãy chọn ngày khác.');
  await expect(page.getByRole('button', { name: 'Tải kết quả đang xem' })).toBeDisabled();
});

test('the model description opens, and the back link leaves for the dashboard (signed out: the login page)', async ({ page }) => {
  await openDemo(page);
  await page.getByText('Về mô hình và kết quả đánh giá').click();
  await expect(page.getByText('Tập test: 2.521 dòng; tại ngưỡng 0,50, recall 87,28%, precision 40,11%.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tài liệu mô hình và thuyết trình' })).toHaveAttribute('target', '_blank');
  await page.getByRole('link', { name: 'TerraWatch' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('reachable from the login page', async ({ page }) => {
  await openDemo(page, { url: '/login' });
  await page.getByRole('link', { name: 'Xem demo mô hình trên dữ liệu lịch sử' }).click();
  await expect(page).toHaveURL(/\/model-demo$/);
  await expect(page.getByRole('heading', { name: 'Demo mô hình sạt lở' })).toBeVisible();
});

test('reachable from the dashboard top bar, and its back link returns to the dashboard when signed in', async ({ page }) => {
  await openDemo(page, { role: 'officer', url: '/' });
  await page.getByRole('link', { name: 'Demo mô hình' }).click();
  await expect(page).toHaveURL(/\/model-demo$/);
  await expect(page.getByRole('heading', { name: 'Demo mô hình sạt lở' })).toBeVisible();
  await page.getByRole('link', { name: 'TerraWatch' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Công cụ' })).toBeVisible();
});
