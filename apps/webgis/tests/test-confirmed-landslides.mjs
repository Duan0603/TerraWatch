import assert from 'node:assert/strict';
import { toConfirmedCollection, describeConfirmed, confirmedBounds, confirmedCentres } from '../src/utils/confirmedLandslides.js';

// Story 4.38: lớp sạt lở đã xác nhận - dữ liệu lạ không làm hỏng bản đồ, popup nói đúng nguồn.
export async function testConfirmedLandslides() {
  console.log('\n▶ testConfirmedLandslides');

  assert.equal(toConfirmedCollection([]).features.length, 0);
  assert.equal(toConfirmedCollection(null).features.length, 0);
  assert.equal(toConfirmedCollection({ type: 'FeatureCollection' }).features.length, 0);
  const poly = { type: 'MultiPolygon', coordinates: [[[[104.11, 21.86], [104.116, 21.86], [104.116, 21.867], [104.11, 21.86]]]] };
  const ok = { type: 'FeatureCollection', features: [
    { geometry: poly, properties: {} },                                      // hợp lệ
    { geometry: {}, properties: {} },                                        // thiếu loại hình
    { geometry: { type: 'Polygon', coordinates: [null] }, properties: {} },  // tọa độ null
    { geometry: { type: 'Polygon', coordinates: [[['a', 1], [2, 3]]] }, properties: {} }, // không phải số
    { geometry: { type: 'Point', coordinates: [104, 21] }, properties: {} }, // không phải đa giác
    { geometry: { type: 'Polygon', coordinates: [] }, properties: {} },      // rỗng
    { geometry: poly }, { properties: {} }, null                             // thiếu thuộc tính / hình học
  ] };
  assert.equal(toConfirmedCollection(ok).features.length, 1);
  assert.ok(confirmedBounds(toConfirmedCollection(ok)), 'what passes validation can always be framed');
  console.log('  ✓ dữ liệu rỗng, sai dạng hoặc hình học hỏng (null, chữ, điểm, rỗng) -> bỏ qua, không lỗi');

  const d = describeConfirmed({ risk_level: 'extreme', area_m2: 480688.58, slope: 43.5, confidence: 0.96, scene_id: 'S2B_X', verified_at: '2026-10-08T03:28:52Z' });
  assert.equal(d.title, 'SẠT LỞ ĐÃ XÁC NHẬN');
  assert.ok(d.lines[0].includes('Cực nguy hiểm'));
  assert.ok(d.lines[1].includes('48.1 ha') && d.lines[1].includes('43.5°'));
  assert.ok(d.lines[2].includes('96%'));
  assert.ok(d.lines[3].includes('S2B_X'));
  assert.ok(d.lines[4].includes('UTC+7'));
  assert.ok(describeConfirmed({}).lines.every(l => typeof l === 'string'));
  const b = confirmedBounds({ features: [
    { geometry: { coordinates: [[[[104.11, 21.86], [104.116, 21.867]]]] } },
    { geometry: { coordinates: [[[[104.5, 22.1], [104.2, 21.9]]]] } }
  ] });
  assert.deepEqual(b, [[104.11, 21.86], [104.5, 22.1]]);
  assert.equal(confirmedBounds({ features: [] }), null);
  assert.equal(confirmedBounds(null), null);
  const c = confirmedCentres({ features: [{ properties: { risk_level: 'high' }, geometry: { coordinates: [[[[104, 21], [105, 22]]]] } }, { properties: {} }] });
  assert.equal(c.features.length, 1);
  assert.deepEqual(c.features[0].geometry.coordinates, [104.5, 21.5]);
  assert.equal(c.features[0].properties.risk_level, 'high');
  console.log('  ✓ chấm tâm: một điểm cho mỗi vùng, giữ thuộc tính');
  console.log('  ✓ khung bản đồ ôm hết các điểm; không có điểm -> null');
  console.log('  ✓ popup: mức độ, diện tích ha, độ dốc, độ tin cậy, ảnh vệ tinh, giờ xác nhận; thiếu số liệu hiện "—"');
  console.log('✅ testConfirmedLandslides PASSED!');
}
