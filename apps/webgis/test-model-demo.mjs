import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { summarize } from './src/data/modelDemo.js';

const root = new URL('./public/model-demo/', import.meta.url);
const readJson = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));

test('replay assets preserve all rows, real model scores and geographic cells', async () => {
  const index = await readJson('index.json');
  assert.equal(index.scenarios.length, 9);
  let total = 0;
  for (const scenario of index.scenarios) {
    const bytes = await readFile(new URL(scenario.url, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), scenario.sha256);
    const data = JSON.parse(bytes);
    assert.equal(data.features.length, scenario.cells);
    const ids = new Set();
    for (const f of data.features) {
      const p = f.properties;
      assert.ok(!ids.has(p.unit_id)); ids.add(p.unit_id);
      assert.equal(p.target_local_date, scenario.date);
      assert.ok(Math.abs(p.p_temporal_gru * p.p_spatial_12dist_slope_soil - p.p_hazard_slope_soil) < 2e-6);
      assert.ok([0, 1].includes(p.mapped_proxy_label));
      const ring = f.geometry.coordinates[0];
      assert.equal(ring.length, 5); assert.deepEqual(ring[0], ring[4]);
      for (const [lon, lat] of ring) assert.ok(lon > 102 && lon < 110 && lat > 10 && lat < 25);
      if (p.history_24h_totals) assert.ok(Math.abs(p.history_24h_totals.reduce((a,b) => a+b, 0)-p.rain_past_168h_mm) < .02);
    }
    total += data.features.length;
  }
  assert.equal(total, 2577);
});

test('threshold statistics match the published test confusion matrix', async () => {
  const index = await readJson('index.json');
  const data = await Promise.all(index.scenarios.filter(s => s.split === 'test').map(s => readJson(s.url)));
  const features = data.flatMap(d => d.features);
  const stats = summarize(features, .5);
  assert.deepEqual([stats.tp,stats.fp,stats.tn,stats.fn], [302,451,1724,44]);
  assert.equal(stats.total, 2521);
  assert.ok(summarize(features, .26).flagged >= stats.flagged);
  assert.ok(summarize(features, .65).flagged <= stats.flagged);
});

test('empty and all-background scenarios do not report fictional recall', () => {
  assert.equal(summarize([], .5).precision, null);
  assert.equal(summarize([], .5).recall, null);
  assert.equal(summarize([{ properties: { mapped_proxy_label: 0, p_hazard_slope_soil: .8 } }], .5).recall, null);
});
