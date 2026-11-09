import assert from 'node:assert/strict';
import { ageLabel, ageTone } from '../src/utils/health.js';

// Story 4.26: bảng tình trạng hệ thống - nhãn tuổi dữ liệu và màu cảnh báo.
export async function testSystemHealth() {
  console.log('\n▶ testSystemHealth');

  assert.equal(ageLabel(null), 'Chưa có dữ liệu');
  assert.equal(ageLabel(0), 'vừa xong');
  assert.equal(ageLabel(5), '5 phút trước');
  assert.equal(ageLabel(59), '59 phút trước');
  assert.equal(ageLabel(60), '1 giờ trước');
  assert.equal(ageLabel(60 * 23 + 59), '23 giờ trước');
  assert.equal(ageLabel(60 * 24 * 3 + 10), '3 ngày trước');
  console.log('  ✓ nhãn tuổi: phút, giờ, ngày, chưa có dữ liệu');

  assert.equal(ageTone(10), 'ok');
  assert.equal(ageTone(60 * 6 - 1), 'ok');
  assert.equal(ageTone(60 * 6), 'warn');
  assert.equal(ageTone(60 * 24 - 1), 'warn');
  assert.equal(ageTone(60 * 24), 'bad');
  assert.equal(ageTone(null), 'bad');
  console.log('  ✓ màu: dưới 6 giờ xanh, đến 24 giờ vàng, quá hạn hoặc không có dữ liệu đỏ');
  console.log('✅ testSystemHealth PASSED!');
}
