import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function testRainWarningApiContracts() {
  console.log('\n▶ testRainWarningApiContracts');

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = resolve(__dirname, '../../../services/gis-service/app/config/rain_warning_sites.json');
  const raw = readFileSync(configPath, 'utf8');
  const cfg = JSON.parse(raw);

  // 1. Root configuration contract
  assert.equal(typeof cfg.source, 'string');
  assert.equal(typeof cfg.period, 'string');
  assert.equal(typeof cfg.method, 'string');
  assert.ok(cfg.hit_rates.watch && cfg.hit_rates.warning && cfg.hit_rates.danger);
  assert.ok(cfg.hit_rates.danger.one_in < cfg.hit_rates.warning.one_in);
  assert.ok(cfg.hit_rates.warning.one_in < cfg.hit_rates.watch.one_in);
  console.log('  ✓ Root hit_rates monotonicity and metadata contracts verified');

  // 2. Site schema contracts
  const langNuKey = '22.1202,104.5278';
  const site = cfg.sites[langNuKey];
  assert.ok(site, 'Site key for Lang Nu must be present');
  assert.equal(site.site_id, 'lang_nu');
  assert.equal(typeof site.latitude, 'number');
  assert.equal(typeof site.longitude, 'number');
  assert.ok(site.latitude >= 8.0 && site.latitude <= 24.0, 'Latitude within Vietnam bounds');
  assert.ok(site.longitude >= 102.0 && site.longitude <= 110.0, 'Longitude within Vietnam bounds');
  console.log('  ✓ Geographic bounding box and coordinates verified for configured sites');

  // 3. Threshold invariant hierarchy: P95 < P99 < P99.9 across all windows
  for (const windowKey of ['24', '72', '120']) {
    const th = site.thresholds[windowKey];
    assert.ok(th, `Thresholds for ${windowKey}h must exist`);
    assert.ok(th.p95 < th.p99, `${windowKey}h p95 must be strictly less than p99`);
    assert.ok(th.p99 < th.p99_9, `${windowKey}h p99 must be strictly less than p99.9`);
  }
  console.log('  ✓ Multi-window precipitation threshold hierarchy strictly monotonic');

  // 4. Quantiles distribution shape
  const q72 = site.daily_peak_72h_quantiles;
  assert.ok(Array.isArray(q72) && q72.length >= 5);
  for (let i = 1; i < q72.length; i++) {
    assert.ok(q72[i][0] > q72[i - 1][0], 'Quantile percentages must be strictly ascending');
    assert.ok(q72[i][1] >= q72[i - 1][1], 'Precipitation mm values must be monotonically non-decreasing');
  }
  console.log('  ✓ 72-hour rainfall cumulative quantile curve verified');
}
