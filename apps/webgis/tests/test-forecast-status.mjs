import assert from 'node:assert/strict';
import { reasonText, forecastState } from '../src/utils/forecastStatus.js';

// Bảng bằng chứng: lý do không có dự báo bằng tiếng Việt, và "hết hạn" được ưu tiên hơn "không có dự báo".
export async function testForecastStatus() {
  console.log('\n▶ testForecastStatus');

  assert.equal(reasonText('AI service unavailable (circuit breaker)'), 'Không kết nối được dịch vụ AI khi chạy dự báo');
  assert.equal(reasonText('SNAPSHOT_MISSING, MODEL_NOT_RELEASED'),
    'Chưa có bộ đặc trưng đầu vào (snapshot) cho lần chạy này; Mô hình dự báo 24 giờ chính thức chưa phát hành');
  assert.equal(reasonText('MODEL_NOT_RELEASED'), 'Mô hình dự báo 24 giờ chính thức chưa phát hành');
  assert.equal(reasonText('NEW_CODE_X'), 'NEW_CODE_X');
  assert.equal(reasonText(null), 'thiếu dữ liệu đầu vào');
  console.log('  ✓ mã lý do → tiếng Việt, mã lạ giữ nguyên');

  assert.equal(forecastState({ expired: true, availability: 'unavailable' }), 'expired');
  assert.equal(forecastState({ expired: false, availability: 'unavailable' }), 'unavailable');
  assert.equal(forecastState({ expired: false, availability: 'available' }), 'fresh');
  assert.equal(forecastState({ status: 'superseded', expired: true, availability: 'available' }), 'superseded');
  console.log('  ✓ thứ tự trạng thái: thay thế > hết hạn > không có dự báo > còn hiệu lực');
}
