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
