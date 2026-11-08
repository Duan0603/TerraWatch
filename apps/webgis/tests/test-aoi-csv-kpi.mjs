import assert from 'node:assert/strict';
import { parseRing, ringToJson, selfIntersects } from '../src/utils/aoiRing.js';
import { toCsv } from '../src/utils/csv.js';
import { FORECAST_COLUMNS } from '../src/utils/reportExport.js';
import { buildKpis } from '../src/utils/kpis.js';

// Vẽ AOI trên bản đồ, xuất CSV và dải KPI của dashboard.
export async function testAoiCsvKpi() {
  console.log('\n▶ testAoiCsvKpi');

  // --- vòng AOI ---
  const sq = [[103.8, 22.3], [103.95, 22.3], [103.95, 22.45], [103.8, 22.45]];
  const json = ringToJson(sq);
  const closed = JSON.parse(json);
  assert.equal(closed.length, 5);
  assert.deepEqual(closed[0], closed[4]); // GeoJSON Polygon bắt buộc khép vòng
  assert.deepEqual(parseRing(json), sq); // parse bỏ điểm đóng -> khứ hồi không đổi
  assert.equal(JSON.parse(ringToJson(sq.slice(0, 2))).length, 2); // < 3 điểm: chưa khép
  assert.deepEqual(parseRing('không phải JSON'), []);
  assert.deepEqual(parseRing('{"a":1}'), []);
  assert.deepEqual(parseRing('[[1,2],["x",3],[4,5]]'), [[1, 2], [4, 5]]); // bỏ điểm sai kiểu
  assert.equal(selfIntersects(sq), false);
  assert.equal(selfIntersects([[0, 0], [2, 2], [2, 0], [0, 2]]), true); // hình nơ
  assert.equal(selfIntersects([[0, 0], [4, 0], [4, 4], [2, 1], [0, 4]]), false); // lõm nhưng hợp lệ
  assert.equal(selfIntersects(sq.slice(0, 3)), false); // tam giác
  assert.equal(selfIntersects([]), false);
  console.log('  ✓ AOI ring: close/open round trip, bad input, self-intersection');

  // --- CSV ---
  const cols = [{ label: 'Tên', value: r => r.a }, { label: 'Ghi chú', value: r => r.b }];
  assert.equal(toCsv(cols, [{ a: 'Sa Pa, Lào Cai', b: 'nói "to"' }]), 'Tên,Ghi chú\r\n"Sa Pa, Lào Cai","nói ""to"""');
  assert.equal(toCsv(cols, [{ a: '=HYPERLINK("x")', b: -5 }]).split('\r\n')[1], '"\'=HYPERLINK(""x"")",-5'); // chặn công thức, số âm giữ nguyên
  assert.equal(toCsv(cols, [{ a: null, b: undefined }]).split('\r\n')[1], ',');
  console.log('  ✓ CSV quoting, formula guard, empty cells');

  const ev = { location: 'Mù Cang Chải', risk: 'extreme', probability: 0.91, status: 'pending', expired: false,
    issuedAt: '2026-11-08T01:00:00Z', validFrom: '2026-11-08T01:00:00Z', validUntil: '2026-11-09T01:00:00Z', modelVersion: 'v1', lat: 21.8, lng: 104.1 };
  const row = toCsv(FORECAST_COLUMNS, [ev]).split('\r\n')[1];
  assert.ok(row.startsWith('Mù Cang Chải,Cực nguy hiểm,0.91,Chờ thẩm định,Không,'));
  console.log('  ✓ forecast export columns');

  // --- KPI ---
  const now = new Date('2026-11-08T05:00:00Z').getTime();
  const hr = (h) => new Date(now + h * 3600000).toISOString();
  const mk = (o) => ({ availability: 'available', expired: false, status: 'pending', risk: 'low', validUntil: hr(20), ...o });
  const events = [
    mk({ risk: 'extreme', validUntil: hr(3) }),            // sắp hết hạn
    mk({ risk: 'high', status: 'approved' }),
    mk({ risk: 'unavailable', availability: 'unavailable' }), // không tính là nguy cơ
    mk({ expired: true, risk: 'extreme', validUntil: hr(-2) }), // hết hạn: không tính nguy cơ / chờ duyệt
  ];
  const reports = [{ status: 'submitted' }, { status: 'processed' }, { status: 'submitted' }];
  const by = (list) => Object.fromEntries(list.map(k => [k.key, k.value]));

  const staff = buildKpis({ events, fieldReports: reports, broadcasts: null, now });
  assert.deepEqual(by(staff), { units: 4, pending: 2, risk: 2, expiring: 1, reports: 2 }); // không admin: không có ô phát lệnh

  const bc = (o) => ({ status: 'ĐÃ GỬI', sentAt: hr(-2), deliveredCount: 3, ...o });
  const admin = buildKpis({ events, fieldReports: [], now,
    broadcasts: [bc({}), bc({ sentAt: hr(-30) }), bc({ status: 'ĐÃ THU HỒI' }), bc({ deliveredCount: 4 })] });
  assert.equal(by(admin).broadcasts, 2); // chỉ lệnh trong 24h và chưa thu hồi
  assert.match(admin.find(k => k.key === 'broadcasts').sub, /^7 thiết bị/);
  console.log('  ✓ KPI counts: expired/unavailable excluded, 24h broadcasts, staff vs admin');

  console.log('✅ testAoiCsvKpi PASSED!');
}
