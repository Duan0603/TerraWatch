import fs from 'node:fs';

// Demo accounts are read from the app's own config so the password lives in one place and is never printed.
const demo = fs.readFileSync(new URL('../src/config/demoLogin.js', import.meta.url), 'utf8');
const pick = (key) => demo.match(new RegExp(`${key}:\\s*'([^']+)'`))[1];

export const ACCOUNTS = {
  admin: pick('admin'),
  officer: pick('officer'),
  citizen: pick('citizen')
};
export const PASSWORD = process.env.VITE_DEMO_PASSWORD || demo.match(/VITE_DEMO_PASSWORD \|\| '([^']+)'/)[1];

export async function signIn(page, email, password = PASSWORD) {
  await page.goto('/login');
  await page.locator('#lg-email').fill(email);
  await page.locator('#lg-password').fill(password);
  await page.locator('button[type="submit"].lg-btn-primary').click();
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
};

/**
 * Fake backend for the flows that must not touch the real database.
 * Pretends to be signed in as `role`, and answers every /api/v1 call: `handler({method, path, body})`
 * returns a JSON body (or [status, body]); anything it does not know gets `[]`.
 * Every call is collected in the returned array.
 */
export async function mockBackend(page, role, handler) {
  const calls = [];
  await page.addInitScript((r) => {
    localStorage.setItem('terrawatch_token', 'e2e-fake-token');
    localStorage.setItem('terrawatch_user', JSON.stringify({ fullName: `E2E ${r}`, role: r }));
  }, role);
  // Map tiles, fonts and style live on other hosts; fail them fast so the tests do not wait on the internet.
  await page.route((url) => !['localhost', '127.0.0.1'].includes(url.hostname), (route) => route.abort());
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const call = {
      method: req.method(),
      path: new URL(req.url()).pathname.replace('/api/v1', ''),
      body: req.postData() ? JSON.parse(req.postData()) : null
    };
    calls.push(call);
    const out = handler(call) ?? [];
    const [status, body] = Array.isArray(out) && out.length === 2 && typeof out[0] === 'number' ? out : [200, out];
    await route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

const future = () => new Date(Date.now() + 12 * 3600e3).toISOString();

/** One ForecastReviewItem as core-api returns it. */
export function forecastItem(runId, name, hazardLevel, extra = {}) {
  return {
    runId,
    reviewStatus: 'pending',
    expired: false,
    availability: 'available',
    hazardLevel,
    probability: 0.62,
    issuedAt: new Date().toISOString(),
    validFrom: new Date().toISOString(),
    validUntil: future(),
    horizonHours: 24,
    modelVersion: 'e2e-model',
    contributingFactors: {},
    inputQuality: {},
    observedRain: null,
    forecastRain: [],
    priorRuns: [],
    unit: {
      name,
      areaId: 1,
      centroidLng: 104.5,
      centroidLat: 21.7,
      slopeAvg: 24.5,
      elevationAvg: 800,
      geometry: { type: 'Polygon', coordinates: [[[104.4, 21.6], [104.6, 21.6], [104.6, 21.8], [104.4, 21.8], [104.4, 21.6]]] }
    },
    ...extra
  };
}

/** Story 4.37: shared tools live in the "Công cụ" menu. */
export async function openTool(page, name) {
  await page.getByRole('button', { name: 'Công cụ' }).click();
  await page.getByRole('menuitem', { name }).click();
}
