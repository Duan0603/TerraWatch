import assert from 'node:assert/strict';
import { describeRisk } from '../src/utils/experimentalRisk.js';

// Lớp GRU thử nghiệm của cán bộ: điểm hiện tại mới được đọc như hiện tại; điểm cũ / thiếu nói rõ lý do.
export async function testExperimentalRisk() {
  console.log('\n▶ testExperimentalRisk');
  const base = { name: 'Ô 002', rain_24h_mm: 24.8, forecast_24h_mm: 14.2,
    hazard_score: 0.5986, temporal_score: 1, spatial_score: 0.5986,
    issue_time: '2026-11-12T13:00:00+00:00', valid_until: '2026-11-13T13:00:00+00:00' };

  const now = describeRisk({ ...base, current: true });
  assert.equal(now.title, 'Ô 002');
  assert.match(now.lines[0], /^Điểm GRU thử nghiệm: 0,599 \(mưa 1,000 × đất\/địa hình 0,599\)$/);
  assert.match(now.lines[1], /24,8 mm .* 14,2 mm/);
  assert.match(now.lines.at(-1), /không phải xác suất, không phải cảnh báo/);
  console.log('  ✓ điểm hiện tại: tách phần mưa và phần đất/địa hình');

  const stale = describeRisk({ ...base, current: false, stale: true });
  assert.match(stale.lines[0], /^Không dùng như hiện tại: dữ liệu mưa cũ .*\(lần trước 0,599\)\.$/);
  assert.match(describeRisk({ ...base, current: false, expired: true }).lines[0], /hết hiệu lực/);
  const held = describeRisk({ name: 'Demo', current: false, reason: 'STATIC_FEATURES_UNAVAILABLE' });
  assert.equal(held.lines[0], 'Chưa có điểm: chưa có số liệu đất/độ dốc cho ô này.');
  assert.equal(held.lines.length, 3); // không có dòng hiệu lực khi chưa có kết quả
  console.log('  ✓ điểm cũ / hết hạn / thiếu số liệu không bị đọc như hiện tại');
}
