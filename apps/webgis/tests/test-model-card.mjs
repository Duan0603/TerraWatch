import assert from 'node:assert/strict';
import { buildModelCardView, fmtPct, fmtNum, shortHash } from '../src/utils/modelCard.js';

// Story 4.29: thẻ mô hình - chỉ hiển thị số có trong thẻ, thiếu thì "chưa có".
const SEG = {
  ready: true, name: 'demo-seg', version: 'v1.0', status: 'experimental - candidate generator', trained_on: 'L4S',
  input_channels: ['B2', 'B3'], sha256_ok: true, temporal_rule: 'ndvi-v1', default_mode: 'balanced',
  modes: { sensitive: 0.532, balanced: 0.721, conservative: 0.904 }, note: 'cần người xác minh',
  metrics: {
    L4S_official_test_800: { F1: 0.5591, IoU: 0.388 },
    VN013_floor2: { operating_points: { balanced: {
      threshold: 0.721, scar_patches_hit: '8/12', regions: 32, regions_hit: 9, regions_false: 17, regions_unverified: 6,
      false_regions_per_km2: 0.104, region_precision_known: 0.35, pixel_window: { precision: 0.7, recall: 0.4 } } } }
  }
};

export async function testModelCard() {
  console.log('\n▶ testModelCard');

  assert.equal(fmtPct(0.5591), '55,9%');
  assert.equal(fmtPct(null), 'chưa có');
  assert.equal(fmtNum(0.104, 3), '0,104');
  assert.equal(fmtNum(undefined), 'chưa có');
  assert.equal(shortHash('cbd88fb40d63'), 'cbd88fb4');
  assert.equal(shortHash(null), 'chưa có');
  console.log('  ✓ định dạng: phần trăm, số thập phân dấu phẩy, mã băm ngắn, thiếu = "chưa có"');

  const v = buildModelCardView({ segmentation: SEG, gru: { ready: true, model_id: 'gru-1', calibrated_probability: false, experimental_only: true, trained_history_provider: 'IMERG', trained_forecast_provider: 'GFS' } });
  assert.equal(v.available, true);
  assert.equal(v.segmentation.modes.length, 3);
  assert.deepEqual(v.segmentation.modes.filter(m => m.isDefault).map(m => m.key), ['balanced']);
  assert.equal(v.segmentation.identity.find(r => r.label.startsWith('Kiểm tra tệp')).value, 'Khớp với thẻ');
  assert.equal(v.segmentation.metrics[0].value, '55,9% / 38,8%');
  assert.equal(v.segmentation.vn013.find(r => r.label === 'Vùng báo nhầm trên mỗi km²').value, '0,104');
  assert.equal(v.segmentation.vn013Label, 'Cảnh VN013, chế độ Cân bằng');
  assert.equal(v.gru.calibrated, false);
  assert.equal(v.gru.rows.find(r => r.label.startsWith('Dữ liệu dự báo')).value, 'GFS');
  console.log('  ✓ thẻ đầy đủ: chế độ mặc định, số liệu, điểm vận hành VN013, GRU chưa hiệu chuẩn');

  const down = buildModelCardView({ segmentation: { ready: false }, gru: { ready: false } });
  assert.equal(down.available, false);
  assert.equal(down.segmentation, null);
  assert.equal(buildModelCardView(undefined).available, false);
  console.log('  ✓ AI service không sẵn sàng: không có hàng số liệu nào');

  const partial = buildModelCardView({ segmentation: { ready: true, name: 'x', modes: {}, metrics: {} } });
  assert.equal(partial.segmentation.metrics.length, 0);
  assert.equal(partial.segmentation.vn013.length, 0);
  assert.equal(partial.segmentation.identity.find(r => r.label === 'Phiên bản').value, 'chưa có');
  assert.equal(partial.segmentation.identity.find(r => r.label.startsWith('Kiểm tra tệp')).value, 'chưa có');
  console.log('  ✓ thẻ thiếu trường: hiện "chưa có", không đoán');
  console.log('✅ testModelCard PASSED!');
}
