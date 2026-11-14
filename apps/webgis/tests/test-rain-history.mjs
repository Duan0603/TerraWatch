import assert from 'node:assert/strict';
import { hourlySlots, forecastChecks, linePaths } from '../src/utils/rainHistory.js';

const row = (iso, extra = {}) => ({ as_of: iso, rain_24h_mm: 10, forecast_24h_mm: 5, ...extra });

// Lịch sử mưa: giờ thiếu giữ trống, dự báo chỉ so với đúng 24 giờ sau.
export async function testRainHistory() {
  console.log('\n▶ testRainHistory');

  const items = [row('2026-11-13T12:00:00+00:00'), row('2026-11-13T13:00:00+00:00'), row('2026-11-13T16:00:00+00:00')];
  const slots = hourlySlots(items);
  assert.equal(slots.length, 5);
  assert.deepEqual(slots.map(s => s.row === null), [false, false, true, true, false]);
  assert.deepEqual(hourlySlots([]), []);
  console.log('  ✓ giờ máy chủ không chạy là ô trống, không thành 0');

  assert.deepEqual(linePaths(slots, r => r.rain_24h_mm, i => i, () => 1), ['M0.0 1.0L1.0 1.0', 'M4.0 1.0']);
  console.log('  ✓ đường mưa gãy tại khoảng trống');

  const checks = forecastChecks([
    row('2026-11-13T12:00:00+00:00', { forecast_24h_mm: 7 }),
    row('2026-11-14T12:00:00+00:00', { rain_24h_mm: 9.5 }),
    row('2026-11-14T13:00:00+00:00', { rain_24h_mm: null })
  ]);
  assert.deepEqual(checks, [{ issued: '2026-11-13T12:00:00+00:00', forecast: 7, actual: 9.5 }]);
  assert.deepEqual(forecastChecks([row('2026-11-13T12:00:00+00:00')]), []);
  console.log('  ✓ dự báo lúc T ghép với mưa 24h ghi lúc T+24h, thiếu thì bỏ qua');
}
