import assert from 'node:assert/strict';
import { hourlySlots, forecastChecks, linePaths } from '../src/utils/rainHistory.js';

export async function testRainHistoryGaps() {
  console.log('\n▶ testRainHistoryGaps');

  const HOUR = 3600e3;
  const baseT = Date.parse('2026-11-15T00:00:00Z');

  // 1. hourlySlots with single entry
  const single = [{ as_of: '2026-11-15T00:00:00Z', rain_24h_mm: 5.0 }];
  const singleSlot = hourlySlots(single);
  assert.equal(singleSlot.length, 1);
  assert.equal(singleSlot[0].t, baseT);
  assert.deepEqual(singleSlot[0].row, single[0]);
  console.log('  ✓ hourlySlots handles single record without interpolation errors');

  // 2. hourlySlots with out-of-order records
  const unordered = [
    { as_of: new Date(baseT + 2 * HOUR).toISOString(), rain_24h_mm: 20 },
    { as_of: new Date(baseT).toISOString(), rain_24h_mm: 5 },
    { as_of: new Date(baseT + HOUR).toISOString(), rain_24h_mm: 10 }
  ];
  const sortedSlots = hourlySlots(unordered);
  assert.equal(sortedSlots.length, 3);
  assert.equal(sortedSlots[0].row.rain_24h_mm, 5);
  assert.equal(sortedSlots[1].row.rain_24h_mm, 10);
  assert.equal(sortedSlots[2].row.rain_24h_mm, 20);
  console.log('  ✓ hourlySlots sorts timestamps chronologically regardless of insertion order');

  // 3. forecastChecks with unmatched pairs
  const unlinked = [
    { as_of: new Date(baseT).toISOString(), forecast_24h_mm: 15.0 },
    { as_of: new Date(baseT + 12 * HOUR).toISOString(), rain_24h_mm: 8.0 }
  ];
  assert.deepEqual(forecastChecks(unlinked), []);

  const nullForecast = [
    { as_of: new Date(baseT).toISOString(), forecast_24h_mm: null },
    { as_of: new Date(baseT + 24 * HOUR).toISOString(), rain_24h_mm: 12.0 }
  ];
  assert.deepEqual(forecastChecks(nullForecast), []);
  console.log('  ✓ forecastChecks ignores missing T+24h matches and null values');

  // 4. linePaths with fragmented gaps and isolated points
  const fragmentedSlots = [
    { t: baseT, row: { rain_24h_mm: 2.0 } },
    { t: baseT + HOUR, row: null },
    { t: baseT + 2 * HOUR, row: { rain_24h_mm: 4.0 } },
    { t: baseT + 3 * HOUR, row: { rain_24h_mm: 6.0 } },
    { t: baseT + 4 * HOUR, row: null },
    { t: baseT + 5 * HOUR, row: { rain_24h_mm: 8.0 } }
  ];
  const paths = linePaths(
    fragmentedSlots,
    r => r.rain_24h_mm,
    i => i * 10,
    v => 100 - v * 5
  );
  assert.equal(paths.length, 3);
  assert.equal(paths[0], 'M0.0 90.0');
  assert.equal(paths[1], 'M20.0 80.0L30.0 70.0');
  assert.equal(paths[2], 'M50.0 60.0');
  console.log('  ✓ linePaths splits SVG paths across missing data intervals');

  // 5. linePaths with all null rows
  const allNull = [{ t: baseT, row: null }, { t: baseT + HOUR, row: null }];
  assert.deepEqual(linePaths(allNull, r => r.rain_24h_mm, i => i, v => v), []);
  console.log('  ✓ linePaths returns empty array when all slots are null');
}
