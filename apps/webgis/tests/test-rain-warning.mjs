import assert from 'node:assert/strict';
import { warningFacts, rolling72, firstReached, hoursBetween, levelKey } from '../src/utils/rainWarning.js';

// Story 4.41: cảnh báo theo mưa Làng Nủ - ba câu "Cách B", cửa sổ 72 giờ, thời điểm đạt mức trong phát lại.
export async function testRainWarning() {
  console.log('\n▶ testRainWarning');

  const a = { complete: true, level: 'danger', totals_mm: { 72: 247 }, percent_days_below: 99.84,
    recorded_landslides_one_in: 40, last_event: { date: '2024-09-10', label: 'Lũ bùn đá Làng Nủ' } };
  const f = warningFacts(a, '1998–2026', 7);
  assert.equal(f.length, 3);
  assert.ok(f[0].includes('247 mm') && f[0].includes('99,84%') && f[0].includes('1998–2026'));
  assert.ok(f[1].includes('1/40') && f[1].includes('tối thiểu'));
  assert.ok(f[2].includes('10/09/2024') && f[2].includes('Làng Nủ'));
  assert.ok(!f.join(' ').includes('xác suất'), 'never phrased as a probability');
  assert.equal(warningFacts({ complete: false })[0], 'Chưa đủ số liệu mưa của 5 ngày qua để xếp mức.');
  const calm = warningFacts({ complete: true, level: null, totals_mm: { 72: 3 }, percent_days_below: 40 }, '1998–2026', 7);
  assert.ok(calm.at(-1).includes('chưa vượt mức theo dõi'));
  assert.equal(levelKey(null), 'missing'); assert.equal(levelKey({ complete: true, level: null }), 'none');
  console.log('  ✓ ba câu: mức bất thường, tỉ lệ ghi nhận tối thiểu, lần gần nhất; không nói "xác suất"');

  const r = rolling72(Array(80).fill(1));
  assert.equal(r[70], null); assert.equal(r[71], 72); assert.equal(r[79], 72);
  const gap = Array(80).fill(1); gap[75] = null;
  assert.equal(rolling72(gap)[79], null);
  console.log('  ✓ mưa 72 giờ: đủ 72 giờ mới tính, thiếu giờ thì bỏ trống');

  const hours = [{ interval_end: '2024-09-07T23:00:00Z', level: 'watch' }, { interval_end: '2024-09-08T10:00:00Z', level: 'warning' },
    { interval_end: '2024-09-09T20:00:00Z', level: 'danger' }];
  const fr = firstReached(hours);
  assert.equal(fr.warning, '2024-09-08T10:00:00Z'); assert.equal(fr.danger, '2024-09-09T20:00:00Z');
  assert.equal(firstReached([{ level: null }]).watch, null);
  assert.equal(hoursBetween(fr.warning, '2024-09-09T23:00:00Z'), 37);
  console.log('  ✓ phát lại: lần đầu đạt từng mức, cảnh báo trước 37 giờ');
  console.log('✅ testRainWarning PASSED!');
}

export async function testRainWarningChart() {
  console.log('\n▶ testRainWarningChart');
  const { dayTicks, indexOf, relativeToEvent } = await import('../src/utils/rainWarning.js');
  const times = Array.from({ length: 50 }, (_, i) => new Date(Date.UTC(2024, 8, 8, 12) + i * 3600e3).toISOString()); // 19:00 VN 8/9 onwards
  const ticks = dayTicks(times);
  assert.deepEqual(ticks.map(t => t.label), ['09/09', '10/09']);
  assert.equal(times[ticks[0].i], '2024-09-08T17:00:00.000Z'); // midnight in Vietnam
  assert.equal(indexOf(times, '2024-09-09T23:00:00Z'), 35);
  assert.equal(indexOf(times, '2025-01-01T00:00:00Z'), null);
  assert.equal(relativeToEvent('2024-09-09T20:00:00Z', '2024-09-09T23:00:00Z'), 'còn 3 giờ tới thời điểm sạt');
  assert.equal(relativeToEvent('2024-09-10T04:00:00Z', '2024-09-09T23:00:00Z'), '5 giờ sau thời điểm sạt');
  console.log('  ✓ biểu đồ: mốc ngày theo giờ Việt Nam, vị trí thời điểm sạt, "còn/sau X giờ"');
  console.log('✅ testRainWarningChart PASSED!');
}

export async function testRainWarningActions() {
  console.log('\n▶ testRainWarningActions');
  const { actionFor, eventRelation, leadHours } = await import('../src/utils/rainWarning.js');
  const zone = { label: 'Vùng lũ bùn đá 10/9/2024', footprint: { area_ha: 69.4, people_estimate: 145, people_from_buildings: 301 },
    buffer_100m: { area_ha: 147.6, people_estimate: 232, people_from_buildings: 441 } };
  assert.equal(actionFor(null, zone).title, 'Không cần hành động');
  assert.ok(actionFor('watch', zone).text.includes('~145–301 người'));
  assert.ok(actionFor('warning', zone).title === 'Chuẩn bị sơ tán' && actionFor('warning', zone).text.includes('69,4 ha'));
  const d = actionFor('danger', zone);
  assert.ok(d.title === 'Sơ tán ngay' && d.text.includes('~232–441 người') && d.people === 232);
  assert.ok(actionFor('danger', null).text.includes('Chưa có vùng ảnh hưởng'));
  console.log('  ✓ việc cần làm theo mức: số người lấy đúng vùng (đỏ khi Cảnh báo, đỏ + 100 m khi Nguy hiểm)');

  const hour = { event_utc: '2024-09-09T23:00:00Z', event_precision: 'hour' };
  assert.equal(eventRelation('2024-09-09T20:00:00Z', hour), 'còn 3 giờ tới thời điểm sạt');
  const day = { event_utc: '2020-10-17T17:00:00Z', event_end_utc: '2020-10-18T17:00:00Z', event_precision: 'day' };
  assert.equal(eventRelation('2020-10-17T05:00:00Z', day), 'còn 12 giờ tới ngày sạt');
  assert.equal(eventRelation('2020-10-18T01:00:00Z', day), 'trong ngày sạt (không rõ giờ)');
  assert.equal(eventRelation('2020-10-18T20:00:00Z', day), '3 giờ sau ngày sạt');
  assert.equal(leadHours('2020-10-16T17:00:00Z', day), 24);
  console.log('  ✓ phát lại: vụ chỉ biết ngày tính theo cả ngày, vụ có giờ tính theo giờ');
  console.log('✅ testRainWarningActions PASSED!');
}

export async function testRainWarningOnset() {
  console.log('\n▶ testRainWarningOnset');
  const { onsetBefore } = await import('../src/utils/rainWarning.js');
  const h = (lvls) => lvls.map((level, i) => ({ level, interval_end: `t${i}` }));
  // danger at the start, a dip to normal, then a new rise before the event at index 7
  const o = onsetBefore(h(['danger', 'danger', 'watch', null, null, 'warning', 'danger', 'danger', 'warning']), 7);
  assert.deepEqual(o.danger, { at: 't6', at_start: false });
  assert.deepEqual(o.warning, { at: 't5', at_start: false });
  assert.deepEqual(o.watch, { at: 't5', at_start: false });
  // level held since the replay began
  assert.deepEqual(onsetBefore(h(['warning', 'warning', 'danger']), 2).warning, { at: 't0', at_start: true });
  assert.equal(onsetBefore(h([null, null, null]), 2).watch, null);
  console.log('  ✓ mốc cảnh báo = lúc mưa lên lại lần cuối trước khi sạt; giữ nguyên từ đầu đoạn thì báo rõ');
  console.log('✅ testRainWarningOnset PASSED!');
}

export async function testRainWarningRunout() {
  console.log('\n▶ testRainWarningRunout');
  const { runoutStep, runoutAction } = await import('../src/utils/rainWarning.js');
  const runout = { steps: [{ rain72_mm: 79.4, area_ha: 6.8, lowest_elev_m: 624, people: 0, buildings: 0, roads_km: 0 },
    { rain72_mm: 128, area_ha: 57.9, lowest_elev_m: 219, people: 4, buildings: 1, roads_km: 0.01 },
    { rain72_mm: 236, area_ha: 67, lowest_elev_m: 180, people: 79, buildings: 49, roads_km: 1.09 }] };
  assert.equal(runoutStep(runout, 50), null);
  assert.equal(runoutStep(runout, 79.4).area_ha, 6.8);
  assert.equal(runoutStep(runout, 200).rain72_mm, 128);
  assert.equal(runoutStep(runout, 300).people, 79);
  assert.equal(runoutStep(null, 300), null);
  const a = runoutAction('danger', runoutStep(runout, 250));
  assert.ok(a.title === 'Sơ tán ngay' && a.text.includes('~79 người, 49 nhà') && a.text.includes('180 m'));
  assert.ok(runoutAction(null, null).text.includes('chưa hình thành dòng bùn đá'));
  console.log('  ✓ phạm vi theo mưa: chọn đúng bậc, dưới bậc đầu thì không vẽ vùng; việc cần làm lấy số người/nhà của bậc đó');
  console.log('✅ testRainWarningRunout PASSED!');
}
