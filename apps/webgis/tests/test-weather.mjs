import assert from 'node:assert/strict';
import { weatherKind, dayLabel, numberText, rainLevel24h, scoreText } from '../src/utils/weather.js';

// Bảng thời tiết 7 ngày: mã WMO, nhãn ngày theo lịch Việt Nam, số thiếu không thành 0.
export async function testWeather() {
  console.log('\n▶ testWeather');

  assert.equal(weatherKind(0).kind, 'clear');
  assert.equal(weatherKind(2).kind, 'partly');
  assert.equal(weatherKind(45).kind, 'fog');
  assert.equal(weatherKind(51).kind, 'drizzle');
  assert.equal(weatherKind(63).kind, 'rain');
  assert.equal(weatherKind(82).label, 'Mưa to');
  assert.equal(weatherKind(95).kind, 'storm');
  assert.equal(weatherKind(null).kind, 'unknown');
  console.log('  ✓ mã WMO → loại thời tiết, thiếu mã không đoán');

  assert.equal(dayLabel('2026-11-11', 0), 'Hôm nay');
  assert.equal(dayLabel('2026-11-12', 1), 'Ngày mai');
  assert.equal(dayLabel('2026-11-15', 4), 'CN 15/11');
  assert.equal(dayLabel('2026-11-16', 5), 'T2 16/11');
  console.log('  ✓ nhãn ngày giữ đúng ngày Việt Nam');

  assert.equal(numberText(null, ' mm'), '–');
  assert.equal(numberText(0, ' mm', 1), '0 mm');
  assert.equal(numberText(19.74, ' mm', 1), '19,7 mm');
  console.log('  ✓ giá trị thiếu hiển thị "–", không thành 0');

  assert.equal(rainLevel24h(null), null);
  assert.equal(rainLevel24h(21.3).level, 'below');
  assert.equal(rainLevel24h(50).level, 'below'); // "trên 50 mm" nên 50 chưa phải mưa to
  assert.equal(rainLevel24h(50.1).level, 'heavy');
  assert.equal(rainLevel24h(100).level, 'heavy');
  assert.equal(rainLevel24h(100.1).level, 'very-heavy');
  console.log('  ✓ cấp mưa 24h theo QĐ 18/2021/QĐ-TTg, đúng biên 50 và 100 mm');

  assert.equal(scoreText(0.000004810250189333029), '< 0,001'); // giá trị thật, không thành "0.000"
  assert.equal(scoreText(0.4800521444020835), '0,480');
  assert.equal(scoreText(0.001), '0,001');
  assert.equal(scoreText(0), '0,000');
  assert.equal(scoreText(null), '–');
  console.log('  ✓ điểm GRU: số rất nhỏ hiện "< 0,001", dấu phẩy thập phân');
}
