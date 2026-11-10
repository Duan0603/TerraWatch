import assert from 'node:assert/strict';
import { durationText, shortDurationText, approvalRate, reviewKpiCard, reviewSummaryRows } from '../src/utils/reviewKpi.js';
import { buildKpis } from '../src/utils/kpis.js';

// Story 4.34: KPI thẩm định - thời gian duyệt, tỷ lệ duyệt, dự báo hết hạn chưa duyệt.
export async function testReviewKpi() {
  console.log('\n▶ testReviewKpi');

  assert.equal(durationText(null), '—');
  assert.equal(durationText(undefined), '—');
  assert.equal(durationText(0.2), 'dưới 1 phút');
  assert.equal(durationText(42.4), '42 phút');
  assert.equal(durationText(60), '1 giờ');
  assert.equal(durationText(185), '3 giờ 5 phút');
  assert.equal(durationText(60 * 24 * 2 + 60 * 4), '2 ngày 4 giờ');
  assert.equal(durationText(60 * 24), '1 ngày');
  console.log('  ✓ thời gian: phút, giờ, ngày, thiếu = "—"');

  assert.equal(shortDurationText(null), '—');
  assert.equal(shortDurationText(0.016), '<1 phút');
  assert.equal(shortDurationText(42.4), '42 phút');
  assert.equal(shortDurationText(185), '3,1 giờ');
  assert.equal(shortDurationText(60 * 52), '2,2 ngày');
  console.log('  ✓ dạng rút gọn cho thẻ KPI');

  assert.equal(approvalRate({ approved: 18, rejected: 5 }), 78);
  assert.equal(approvalRate({ approved: 0, rejected: 0 }), null);
  assert.equal(approvalRate(null), null);
  console.log('  ✓ tỷ lệ duyệt: làm tròn, không có quyết định = null (không phải 0%)');

  const card = reviewKpiCard({ windowDays: 7, approved: 18, rejected: 5, avgMinutes: 42, medianMinutes: 30, expiredUnreviewed: 3 });
  assert.equal(card.label, 'Thẩm định 7 ngày');
  assert.equal(card.value, '42 phút');
  assert.equal(card.sub, '78% duyệt · 3 hết hạn chưa duyệt');
  assert.equal(card.tone, 'warn');
  const calm = reviewKpiCard({ windowDays: 7, approved: 2, rejected: 0, avgMinutes: 5, medianMinutes: 5, expiredUnreviewed: 0 });
  assert.equal(calm.tone, 'neutral');
  assert.equal(calm.sub, '100% duyệt · không có dự báo bỏ lỡ');
  const empty = reviewKpiCard({ windowDays: 7, approved: 0, rejected: 0, avgMinutes: null, medianMinutes: null, expiredUnreviewed: 0 });
  assert.equal(empty.value, '—');
  assert.equal(card.compact, true);
  assert.equal(empty.sub, 'chưa có quyết định · không có dự báo bỏ lỡ');
  assert.equal(reviewKpiCard(null), null);
  console.log('  ✓ thẻ KPI: có quyết định, yên ổn, chưa có quyết định, không tải được');

  const rows = reviewSummaryRows({ windowDays: 30, approved: 3, rejected: 1, avgMinutes: 90, medianMinutes: 60, expiredUnreviewed: 2 });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].value, '4');
  assert.equal(rows[1].value, '75%');
  assert.equal(rows[2].value, '1 giờ 30 phút');
  assert.deepEqual(reviewSummaryRows(null), []);
  console.log('  ✓ khối tóm tắt: 5 dòng, null thì không có dòng nào');

  const base = { events: [], fieldReports: [], broadcasts: null };
  assert.equal(buildKpis(base).some(k => k.key === 'review'), false);
  assert.equal(buildKpis({ ...base, reviewMetrics: { windowDays: 7, approved: 1, rejected: 0, avgMinutes: 3, medianMinutes: 3, expiredUnreviewed: 0 } }).some(k => k.key === 'review'), true);
  console.log('  ✓ dải KPI: chỉ có thẻ thẩm định khi đã có số liệu');
  console.log('✅ testReviewKpi PASSED!');
}
