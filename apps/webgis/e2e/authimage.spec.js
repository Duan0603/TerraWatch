import { test, expect } from '@playwright/test';
import { mockBackend, openTool } from './helpers.js';

// Mocked API (officer). AuthImage has no screen of its own: field report photos need the login token, so the component fetches them with axios
// and shows a blob URL. It is exercised through the field reports dialog (thumbnail and lightbox).
// fieldreports.spec.js asserts the blob thumbnail, the request path, the lightbox and the "Không có ảnh" placeholder; here:
// UW-DASH-018 (the request carries the token, alt texts), 020 (no path: no request), 021 (500), 022 (network), 023 (401),
// 024 (answer that is not an image, path of the wrong type), 025 (double click on the thumbnail).

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const report = (id, extra = {}) => ({
  report_id: id, status: 'submitted', longitude: 104.2, latitude: 21.9, description: `Nứt đất ${id}`,
  observed_at: '2026-10-10T03:00:00Z', image_url: null, submitter_name: `Người báo ${id}`, submitter_phone: null, ...extra
});
const IMG = '/api/v1/community-reports/11/image';
const thumb = (page) => page.getByRole('img', { name: 'Hiện trường' });

/** `image(route)` decides how the image request is answered; default is a real 1x1 PNG. */
async function openReports(page, { rows, image, settle = true } = {}) {
  const reports = rows ?? [report(11, { image_url: IMG })];
  const calls = await mockBackend(page, 'officer', ({ path }) => (path === '/community-reports' ? reports : undefined));
  const imageGets = [];
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().includes('/community-reports/11/image')) imageGets.push({ url: r.url(), auth: r.headers().authorization }); });
  await page.route('**/api/v1/community-reports/11/image', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (image) return image(route);
    return route.fulfill({ status: 200, headers: CORS, contentType: 'image/png', body: PNG });
  });
  await page.goto('/');
  await openTool(page, 'Báo cáo hiện trường');
  // settle = false: the test expects the page to be left at once (a 401 on the photo redirects, so the dialog may never be seen)
  if (settle) await expect(page.getByRole('heading', { name: 'BÁO CÁO HIỆN TRƯỜNG TỪ CỘNG ĐỒNG' })).toBeVisible();
  return { calls, imageGets };
}

// The dev server runs React.StrictMode, which mounts every effect twice, so one AuthImage sends the same GET twice; the tests count
// "one mount" as whatever the thumbnail needed and compare the lightbox against that.
test('UW-DASH-018: the photo request carries the bearer token and the path is asked without a doubled /api/v1', async ({ page }) => {
  const { imageGets } = await openReports(page);
  await expect(thumb(page)).toHaveAttribute('src', /^blob:/);
  expect(imageGets.length).toBeGreaterThan(0);
  for (const g of imageGets) {
    expect(new URL(g.url).pathname).toBe('/api/v1/community-reports/11/image');
    expect(g.auth).toBe('Bearer e2e-fake-token');
  }
  // a real image was decoded: the blob is the PNG, not an empty box
  await expect.poll(() => thumb(page).evaluate((el) => el.naturalWidth)).toBe(1);
});

test('UW-DASH-018: opening the lightbox loads the photo again under the "Phóng to" label, and closing it removes only the large image', async ({ page }) => {
  const { imageGets } = await openReports(page);
  await expect(thumb(page)).toHaveAttribute('src', /^blob:/);
  const perMount = imageGets.length;
  await thumb(page).click();
  const big = page.getByRole('img', { name: 'Phóng to' });
  await expect(big).toHaveAttribute('src', /^blob:/);
  expect(imageGets).toHaveLength(2 * perMount); // the lightbox is one more AuthImage, not a reuse of the thumbnail's blob
  expect(imageGets.every((g) => g.auth === 'Bearer e2e-fake-token')).toBe(true);
  const thumbSrc = await thumb(page).getAttribute('src');
  expect(await big.getAttribute('src')).not.toBe(thumbSrc); // each AuthImage owns its own blob URL
  await page.mouse.click(3, 3);
  await expect(big).toHaveCount(0);
  await expect(thumb(page)).toHaveAttribute('src', thumbSrc);
});

test('UW-DASH-020: a report with no image path (null or empty text) shows the placeholder and asks for no photo', async ({ page }) => {
  const { imageGets } = await openReports(page, { rows: [report(11, { image_url: null }), report(12, { image_url: '' })] });
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(page.getByText('Nứt đất 12')).toBeVisible();
  await expect(page.getByText('Không có ảnh')).toHaveCount(2);
  await expect(thumb(page)).toHaveCount(0);
  expect(imageGets).toEqual([]);
});

test('UW-DASH-021: a 500 on the photo leaves the report readable and the dialog usable; no broken image is drawn', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { calls } = await openReports(page, { image: (route) => route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{}' }) });
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect.poll(() => calls.length).toBeGreaterThan(0);
  await expect(thumb(page)).toHaveCount(0); // no <img> with a dead src
  await expect(page.getByRole('alert')).toHaveCount(0); // the list itself loaded fine, so no list error
  await page.getByRole('combobox').selectOption('ALL'); // the dialog still reacts
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  expect(errors).toEqual([]);
});

// ponytail: pass onError from FieldReportsModal to AuthImage and show "Không tải được ảnh" in the thumbnail frame.
test.fixme('UW-DASH-021/022: a photo that cannot be loaded says so in its frame', async ({ page }) => {
  // BUG: expected a short text such as "Không tải được ảnh" (the CSV wants a clear error); actual: the 90x90 frame is an empty black box
  // (AuthImage swallows the error when no onError is given, and FieldReportsModal never passes one), so the user cannot tell a failure from a loading photo.
  await openReports(page, { image: (route) => route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: '{}' }) });
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(page.getByText(/Không tải được ảnh|Không tải được hình/)).toBeVisible();
});

test('UW-DASH-022: a network failure on the photo draws no image and the rest of the dialog keeps working', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openReports(page, { image: (route) => route.abort('connectionrefused') });
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(page.getByText('Người báo 11')).toBeVisible();
  await expect(thumb(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Chuyển Đã Xử Lý' }).waitFor(); // the action buttons are still there
  expect(errors).toEqual([]);
});

test('UW-DASH-023: a 401 on the photo clears the session and sends the user to the login page', async ({ page }) => {
  await openReports(page, { settle: false, image: (route) => route.fulfill({ status: 401, headers: CORS, contentType: 'application/json', body: '{}' }) });
  await expect(page).toHaveURL(/\/login/);
});

test('UW-DASH-024: an answer that is not an image gives a blob the browser cannot draw; the page does not raise an error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openReports(page, { image: (route) => route.fulfill({ status: 200, headers: CORS, contentType: 'text/html', body: '<html>not an image</html>' }) });
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  await expect(thumb(page)).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => thumb(page).evaluate((el) => el.complete && el.naturalWidth)).toBe(0); // broken image, not a crash
  await expect(page.getByRole('button', { name: 'Chuyển Đã Xử Lý' })).toBeVisible();
  expect(errors).toEqual([]);
});

// ponytail: in AuthImage skip a path that is not a string (typeof path !== 'string').
test.fixme('UW-DASH-024: an image path of the wrong type (a number) does not take the whole app down', async ({ page }) => {
  // BUG: expected the report to show with the "Không có ảnh" placeholder or an empty frame; actual: path.replace is not a function
  // is thrown in AuthImage and, with no error boundary around the dialog, React unmounts the whole dashboard.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openReports(page, { rows: [report(11, { image_url: 12345 })] });
  await expect(page.getByText('Nứt đất 11')).toBeVisible();
  expect(errors).toEqual([]);
});

test('UW-DASH-025: a double click on the thumbnail opens the lightbox once: the photo is fetched for one extra image, not two', async ({ page }) => {
  const { imageGets } = await openReports(page);
  await expect(thumb(page)).toHaveAttribute('src', /^blob:/);
  const perMount = imageGets.length;
  await thumb(page).dblclick();
  // the first click opens the lightbox; the second lands on its backdrop and closes it again
  await expect(page.getByRole('img', { name: 'Phóng to' })).toHaveCount(0);
  await expect.poll(() => imageGets.length).toBe(2 * perMount);
  await expect(thumb(page)).toHaveAttribute('src', /^blob:/); // the thumbnail is untouched
});
