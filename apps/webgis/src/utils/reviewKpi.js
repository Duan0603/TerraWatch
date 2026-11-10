// Story 4.34: review performance numbers (from GET /forecasts/reviews/metrics) as text for the KPI strip and the audit dialog.
// Pure functions so Node can test them. A missing value shows as "—", never as 0.

/** Minutes -> "dưới 1 phút" / "42 phút" / "3 giờ 5 phút" / "2 ngày 4 giờ"; null -> "—". */
export function durationText(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const total = Math.round(minutes);
  if (total < 1) return 'dưới 1 phút';
  if (total < 60) return `${total} phút`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours < 24) return mins ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} ngày ${rest} giờ` : `${days} ngày`;
}

/** Short form for a KPI card value (at most 7 characters): "<1 phút", "42 phút", "3,1 giờ", "2,2 ngày"; null -> "—". */
export function shortDurationText(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  if (minutes < 1) return '<1 phút';
  if (minutes < 60) return `${Math.round(minutes)} phút`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1).replace('.', ',')} giờ`;
  return `${(hours / 24).toFixed(1).replace('.', ',')} ngày`;
}

/** Share of approvals among decisions, as a whole percent; null when nothing was decided. */
export function approvalRate(m) {
  const decided = (m?.approved ?? 0) + (m?.rejected ?? 0);
  return decided ? Math.round((m.approved / decided) * 100) : null;
}

/** The card for the KPI strip; null when the metrics could not be loaded. */
export function reviewKpiCard(m) {
  if (!m) return null;
  const rate = approvalRate(m);
  const expired = m.expiredUnreviewed ?? 0;
  const parts = [rate == null ? 'chưa có quyết định' : `${rate}% duyệt`];
  parts.push(expired ? `${expired} hết hạn chưa duyệt` : 'không có dự báo bỏ lỡ');
  return {
    key: 'review',
    label: `Thẩm định ${m.windowDays} ngày`,
    value: shortDurationText(m.avgMinutes),
    sub: parts.join(' · '),
    tone: expired ? 'warn' : 'neutral',
    compact: true // chữ, không phải số đếm: dùng cỡ chữ nhỏ hơn
  };
}

/** Rows for the summary block of the audit dialog. */
export function reviewSummaryRows(m) {
  if (!m) return [];
  const rate = approvalRate(m);
  return [
    { label: 'Đã quyết định', value: String(m.approved + m.rejected), sub: `${m.approved} duyệt · ${m.rejected} từ chối` },
    { label: 'Tỷ lệ duyệt', value: rate == null ? '—' : `${rate}%`, sub: '' },
    { label: 'Thời gian duyệt trung bình', value: durationText(m.avgMinutes), sub: 'từ lúc phát hành đến lúc quyết định' },
    { label: 'Trung vị', value: durationText(m.medianMinutes), sub: 'một nửa số dự báo được xử lý nhanh hơn' },
    { label: 'Hết hạn chưa duyệt', value: String(m.expiredUnreviewed), sub: 'dự báo hợp lệ nhưng không ai quyết định kịp' }
  ];
}
