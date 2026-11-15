import assert from 'node:assert/strict';
import {
  LEVEL_INFO,
  fmtMm,
  levelKey,
  fmtVnDate,
  fmtVnTime,
  warningFacts,
  firstReached,
  rolling72
} from '../src/utils/rainWarning.js';

export async function testRainWarningThresholds() {
  console.log('\n▶ testRainWarningThresholds');

  // 1. LEVEL_INFO completeness and color tokens
  assert.equal(LEVEL_INFO.none.label, 'Bình thường');
  assert.equal(LEVEL_INFO.watch.label, 'Theo dõi');
  assert.equal(LEVEL_INFO.warning.label, 'Cảnh báo');
  assert.equal(LEVEL_INFO.danger.label, 'Nguy hiểm');
  assert.equal(LEVEL_INFO.missing.label, 'Thiếu dữ liệu');
  assert.equal(LEVEL_INFO.none.color, '#16a34a');
  assert.equal(LEVEL_INFO.danger.color, '#b91c1c');
  console.log('  ✓ LEVEL_INFO color schemes and status labels verified');

  // 2. fmtMm unit formatting edge cases
  assert.equal(fmtMm(null), '—');
  assert.equal(fmtMm(undefined), '—');
  assert.equal(fmtMm(0), '0');
  assert.equal(fmtMm(12.34), '12,3');
  assert.equal(fmtMm('45.6'), '45,6');
  console.log('  ✓ fmtMm handles null, undefined, zero, and decimal precision');

  // 3. levelKey defensive handling
  assert.equal(levelKey(null), 'missing');
  assert.equal(levelKey(undefined), 'missing');
  assert.equal(levelKey({ complete: false }), 'missing');
  assert.equal(levelKey({ complete: true, level: 'watch' }), 'watch');
  assert.equal(levelKey({ complete: true }), 'none');
  assert.equal(levelKey({}), 'none');
  console.log('  ✓ levelKey accurately defaults to missing or none');

  // 4. fmtVnDate & fmtVnTime formatting
  assert.equal(fmtVnDate(null), '—');
  assert.equal(fmtVnTime(null), '—');
  const d = fmtVnDate('2026-11-15T00:00:00Z');
  assert.match(d, /15\/11\/2026/);
  console.log('  ✓ Vietnamese calendar date formatting verified');

  // 5. warningFacts output combinations
  const incompleteFacts = warningFacts({ complete: false });
  assert.equal(incompleteFacts.length, 1);
  assert.match(incompleteFacts[0], /Chưa đủ số liệu mưa/);

  const watchFacts = warningFacts({
    complete: true,
    level: 'watch',
    percent_days_below: 96.5,
    totals_mm: { '72': 142.8 },
    recorded_landslides_one_in: 8,
    last_event: { date: '2024-09-09', label: 'Bão Yagi' }
  }, '1998', 7);
  assert.equal(watchFacts.length, 3);
  assert.match(watchFacts[0], /142,8 mm/);
  assert.match(watchFacts[0], /96,5%/);
  assert.match(watchFacts[1], /1\/8 lần/);
  assert.match(watchFacts[2], /Bão Yagi/);

  const normalFacts = warningFacts({ complete: true, level: null });
  assert.match(normalFacts[normalFacts.length - 1], /Mưa chưa vượt mức theo dõi/);
  console.log('  ✓ warningFacts produces contextual narrative for all alert levels');

  // 6. firstReached level priority
  assert.deepEqual(firstReached([]), { watch: null, warning: null, danger: null });
  const sampleReplay = [
    { interval_end: '2026-11-15T01:00:00Z', level: null },
    { interval_end: '2026-11-15T02:00:00Z', level: 'watch' },
    { interval_end: '2026-11-15T04:00:00Z', level: 'danger' }
  ];
  const reached = firstReached(sampleReplay);
  assert.equal(reached.watch, '2026-11-15T02:00:00Z');
  assert.equal(reached.warning, '2026-11-15T04:00:00Z');
  assert.equal(reached.danger, '2026-11-15T04:00:00Z');
  console.log('  ✓ firstReached computes earliest threshold timestamp with level escalation');

  // 7. rolling72 window edge cases
  const shortSeq = [1, 2, 3];
  assert.deepEqual(rolling72(shortSeq), [null, null, null]);
  const seqWithNull = Array.from({ length: 72 }, (_, i) => (i === 10 ? null : 1.0));
  const rolling = rolling72(seqWithNull);
  assert.equal(rolling[71], null);
  console.log('  ✓ rolling72 rejects windows shorter than 72 or containing gaps');
}
