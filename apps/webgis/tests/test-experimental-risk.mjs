import assert from 'node:assert/strict';
import { describeRisk, usableCount } from '../src/utils/experimentalRisk.js';

// Lớp GRU thử nghiệm của cán bộ: điểm hiện tại mới được đọc như hiện tại; điểm cũ / thiếu nói rõ lý do;
// luôn nói điểm do phần nào quyết định, để ô tím đậm không bị hiểu là "mưa nhiều".
export async function testExperimentalRisk() {
  console.log('\n▶ testExperimentalRisk');
  const base = { name: 'Ô 002', rain_24h_mm: 24.8, forecast_24h_mm: 14.2,
    hazard_score: 0.5986, temporal_score: 1, spatial_score: 0.5986,
    issue_time: '2026-11-12T13:00:00+00:00', valid_until: '2026-11-13T13:00:00+00:00' };

  const now = describeRisk({ ...base, current: true });
  assert.equal(now.title, 'Ô 002');
  assert.match(now.lines[0], /^Điểm mô hình thử nghiệm: 0,599 \(mưa 1,000 × đất\/địa hình 0,599\)$/);
  assert.match(now.lines[1], /mức tối đa.*chủ yếu do đất\/địa hình/);
  assert.match(now.lines[2], /24,8 mm .* 14,2 mm \(Chưa tới mưa lớn\)$/);
  assert.match(now.lines.at(-1), /không phải mức nguy cơ, không phải cảnh báo/);
  console.log('  ✓ điểm hiện tại: tách phần mưa / đất, nói phần nào quyết định, kèm cấp mưa QĐ 18');

  assert.match(describeRisk({ ...base, current: true, temporal_score: 0.0156, spatial_score: 0.525, hazard_score: 0.0082 }).lines[1],
    /^Phần mưa gần 0, nên điểm thấp dù đất\/địa hình ở mức 0,525\.$/);
  assert.match(describeRisk({ ...base, current: true, temporal_score: 0.6 }).lines[1], /Cả phần mưa và phần đất/);
  assert.match(describeRisk({ ...base, current: true, forecast_24h_mm: 120 }).lines[2], /\(Mưa rất to\)$/);
  console.log('  ✓ phần mưa gần 0 / tối đa / ở giữa; mưa > 100 mm là mưa rất to');

  const stale = describeRisk({ ...base, current: false, stale: true });
  assert.match(stale.lines[0], /^Không dùng như hiện tại: dữ liệu mưa cũ .*\(lần trước 0,599\)\.$/);
  assert.match(stale.lines[1], /\(số liệu cũ\)$/); // không gắn cấp mưa cho số liệu cũ
  assert.match(describeRisk({ ...base, current: false, expired: true }).lines[0], /hết hiệu lực/);
  const held = describeRisk({ name: 'Demo', current: false, reason: 'STATIC_FEATURES_UNAVAILABLE' });
  assert.equal(held.lines[0], 'Chưa có điểm: chưa có số liệu đất/độ dốc cho ô này.');
  assert.equal(held.lines.length, 3); // không có dòng hiệu lực khi chưa có kết quả
  console.log('  ✓ điểm cũ / hết hạn / thiếu số liệu không bị đọc như hiện tại');

  const features = [{ current: true, stale: false, forecast_24h_mm: 14 }, { current: false, stale: false, forecast_24h_mm: 9 },
    { current: false, stale: true, forecast_24h_mm: 7 }, { current: false, stale: false }].map(properties => ({ properties }));
  assert.equal(usableCount(features, 'gru'), 1);
  assert.equal(usableCount(features, 'rain'), 2);
  assert.equal(usableCount(null, 'gru'), 0);
  console.log('  ✓ đếm điểm dùng được theo từng chế độ tô màu');
}
