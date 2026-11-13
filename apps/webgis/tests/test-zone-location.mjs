import assert from 'node:assert/strict';
import { pointInRing, rankZones } from '../src/utils/zoneLocation.js';

// Trang công dân: "Vị trí của tôi" — trong vùng cảnh báo nào, vùng nào gần nhất.
export async function testZoneLocation() {
  console.log('\n▶ testZoneLocation');

  const square = [[104.075, 21.835], [104.075, 21.855], [104.095, 21.855], [104.095, 21.835], [104.075, 21.835]];
  assert.equal(pointInRing([104.085, 21.845], square), true);
  assert.equal(pointInRing([104.1, 21.845], square), false);
  const lShape = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 0]];
  assert.equal(pointInRing([1.5, 1.5], lShape), false); // phần khuyết của hình chữ L
  assert.equal(pointInRing([0.5, 1.5], lShape), true);
  console.log('  ✓ điểm trong/ngoài vùng, kể cả vùng lõm');

  const far = { id: 'far', lng: 105.8, lat: 21.0, polygon: square.map(([x, y]) => [x + 1.7, y - 0.8]) };
  const near = { id: 'near', lng: 104.135, lat: 21.845, polygon: square.map(([x, y]) => [x + 0.05, y]) };
  const here = { id: 'here', lng: 104.085, lat: 21.845, polygon: square };
  const ranked = rankZones([far, near, here], [104.08, 21.84]);
  assert.deepEqual(ranked.map(z => z.id), ['here', 'near', 'far']);
  assert.equal(ranked[0].inside, true);
  assert.ok(ranked[1].distanceKm > 5 && ranked[1].distanceKm < 7, `near ≈ 5.7 km, got ${ranked[1].distanceKm}`);
  console.log('  ✓ vùng đang đứng trong lên đầu, còn lại theo khoảng cách');
}

// Thời tiết khi không có cảnh báo: điểm theo dõi gần nhất, toạ độ lấy từ khoá cache để tra mưa không bị 404.
export async function testMonitoredPoints() {
  console.log('\n▶ testMonitoredPoints');
  const { monitoredPoints, nearestPoint } = await import('../src/utils/zoneLocation.js');
  const collection = { features: [
    { geometry: { type: 'Polygon', coordinates: [[[103.78, 22.35], [103.79, 22.35], [103.79, 22.36], [103.78, 22.35]]] },
      properties: { key: '22.3550,103.7850', name: 'Ô 005 - Ta-luy Đèo Ô Quy Hồ' } },
    { geometry: { type: 'Point', coordinates: [104.28, 22.51] }, properties: { key: '22.5100,104.2800', name: 'Bắc Hà' } },
    { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { key: 'hỏng', name: 'Sai khoá' } },
  ] };
  const points = monitoredPoints(collection);
  assert.deepEqual(points.map(p => p.name), ['Bắc Hà', 'Ô 005 - Ta-luy Đèo Ô Quy Hồ']); // bỏ khoá hỏng, xếp theo tên
  assert.deepEqual([points[1].lat, points[1].lng], [22.355, 103.785]);
  console.log('  ✓ toạ độ lấy đúng từ khoá cache, bỏ khoá hỏng');

  const near = nearestPoint(points, [103.84, 22.336]); // thị xã Sa Pa
  assert.equal(near.name, 'Ô 005 - Ta-luy Đèo Ô Quy Hồ');
  assert.ok(near.distanceKm > 5 && near.distanceKm < 7, `≈ 6 km, got ${near.distanceKm}`);
  assert.equal(nearestPoint([], [103.84, 22.336]), null);
  console.log('  ✓ điểm gần nhất và khoảng cách');
}
