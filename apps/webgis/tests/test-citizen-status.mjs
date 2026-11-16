import assert from 'node:assert/strict';
import { pointStatus, areaStatus, pointsForArea, centroid, worse, nearestArea, ADVICE, locateArea, pointNear } from '../src/utils/citizenStatus.js';

// Story 4.43: today's status per area for the citizen page.
export async function testCitizenStatus() {
  console.log('\n▶ testCitizenStatus');

  // ordinary point: 72 h rain and 24 h forecast against its own 28-year percentiles
  const an = (h72, f24) => ({ rain_anomaly: {
    history_72h: { mm: h72[0], level: h72[1], p95: 60.7, p99: 102.6, p99_9: 165.4 },
    forecast_24h: { mm: f24[0], level: f24[1], p95: 24.5 } } });
  let s = pointStatus(an([16.8, null], [0, null]));
  assert.deepEqual([s.now, s.next, s.rain72, s.usual72, s.calibrated], ['none', 'none', 16.8, 60.7, false]);
  s = pointStatus(an([110, 'p99'], [60, 'p99_9']));
  assert.deepEqual([s.now, s.next], ['warning', 'danger']);
  assert.equal(pointStatus(an([null, null], [null, null])).now, 'missing');
  assert.equal(pointStatus(null).now, 'missing');

  // Làng Nủ: the calibrated rain-threshold warning wins
  s = pointStatus({ rain_warning: { now: { complete: true, level: 'danger', totals_mm: { 72: 246.7 } }, next_24h: { complete: true, level: null } },
    rain_anomaly: { history_72h: { mm: 1, p95: 73 }, forecast_24h: { mm: 5 } } });
  assert.deepEqual([s.now, s.next, s.rain72, s.forecast24, s.calibrated], ['danger', 'none', 246.7, 5, true]);

  // area = its worst point (now or next 24 h)
  const a = areaStatus([{ now: 'none', next: 'none' }, { now: 'watch', next: 'warning', key: 'b' }, null]);
  assert.equal(a.point.key, 'b');
  assert.equal(a.worst, 'warning');
  assert.equal(areaStatus([]).worst, 'missing');
  assert.equal(worse('watch', 'missing'), 'watch');
  assert.equal(worse('none', 'danger'), 'danger');

  // points: inside the area, else the nearest within 30 km
  const box = { type: 'MultiPolygon', coordinates: [[[[104.05, 21.8], [104.22, 21.8], [104.22, 21.92], [104.05, 21.92], [104.05, 21.8]]]] };
  const pts = [{ key: 'in', lat: 21.86, lng: 104.11 }, { key: 'far', lat: 22.5, lng: 104.28 }];
  assert.deepEqual(pointsForArea(box, pts).points.map((p) => p.key), ['in']);
  const empty = { type: 'Polygon', coordinates: [[[104.6, 22.65], [104.75, 22.65], [104.75, 22.8], [104.6, 22.8], [104.6, 22.65]]] };
  assert.deepEqual(pointsForArea(empty, pts).points, [], 'Hoàng Su Phì has no point within 30 km');
  const nearBox = { type: 'Polygon', coordinates: [[[104.25, 22.45], [104.3, 22.45], [104.3, 22.48], [104.25, 22.48], [104.25, 22.45]]] };
  const r = pointsForArea(nearBox, pts);
  assert.equal(r.points[0].key, 'far');
  assert.ok(r.nearKm > 0 && r.nearKm <= 30);

  const [cx, cy] = centroid(box);
  assert.ok(Math.abs(cx - 104.135) < 1e-9 && Math.abs(cy - 21.86) < 1e-9, 'centre of the box');
  assert.equal(nearestArea([{ geometry: empty, id: 3 }, { geometry: box, id: 1 }], [104.1, 21.85]).id, 1);
  assert.equal(nearestArea([], [104.1, 21.85]), null);
  for (const k of ['none', 'watch', 'warning', 'danger', 'missing']) assert.ok(ADVICE[k].length > 20);

  // where the citizen stands
  const fs = [{ geometry: box, properties: { area_id: 1 } }, { geometry: empty, properties: { area_id: 3 } }];
  assert.deepEqual(locateArea(fs, [104.11, 21.86]), { feature: fs[0], inside: true, km: 0 });
  const away = locateArea(fs, [108.2, 16.05]); // Đà Nẵng
  assert.equal(away.inside, false);
  assert.ok(away.km > 500);
  assert.equal(locateArea(fs, null), null);
  assert.equal(pointNear(pts, [104.11, 21.861]).key, 'in');
  assert.equal(pointNear(pts, [108.2, 16.05]), null, 'no rain point within 30 km');
  console.log('  ✓ point and area levels, Làng Nủ calibrated warning, points per area, advice');
}
