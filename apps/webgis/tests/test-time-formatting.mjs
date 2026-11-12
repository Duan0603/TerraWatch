import assert from 'node:assert/strict';
import { fmtVN, fmtUtc, hourVN, relativeToNow } from '../src/utils/time.js';

export async function testTimeFormatting() {
  console.log('\n▶ testTimeFormatting');

  // 1. Null/empty fallback
  assert.equal(fmtVN(null), '—');
  assert.equal(fmtVN(undefined), '—');
  assert.equal(fmtUtc(''), '—');

  // 2. UTC to Vietnam (UTC+7) conversion
  const iso = '2026-11-12T04:05:00Z';
  assert.match(fmtVN(iso), /11:05.*12\/11\/2026 \(UTC\+7\)/);
  assert.equal(fmtUtc(iso), '2026-11-12 04:05 UTC');
  assert.equal(hourVN(iso), '11h');

  // Midnight UTC rollover to UTC+7 (18:30Z -> 01:30 next day VN time)
  const rolloverIso = '2026-11-12T18:30:00Z';
  assert.match(fmtVN(rolloverIso), /01:30.*13\/11\/2026 \(UTC\+7\)/);
  assert.equal(hourVN(rolloverIso), '01h');
  console.log('  ✓ UTC to Asia/Ho_Chi_Minh (UTC+7) conversion and rollover validated');

  // 3. Relative countdown (remaining & overdue)
  const baseNow = new Date('2026-11-12T04:00:00Z').getTime();
  assert.equal(relativeToNow('2026-11-12T04:45:00Z', baseNow), 'còn 45 phút');
  assert.equal(relativeToNow('2026-11-12T05:30:00Z', baseNow), 'còn 1 giờ 30 phút');
  assert.equal(relativeToNow('2026-11-12T03:40:00Z', baseNow), 'đã quá 20 phút');
  assert.equal(relativeToNow('2026-11-12T01:45:00Z', baseNow), 'đã quá 2 giờ 15 phút');
  console.log('  ✓ relativeToNow countdown and expiry labels validated');

  console.log('✅ testTimeFormatting PASSED!');
}
