// Story 4.26: how to show the age of a data source on the system-health panel.

/** Minutes -> "5 phút trước" / "3 giờ trước" / "2 ngày trước"; null means the source has no data at all. */
export function ageLabel(minutes) {
  if (minutes == null) return 'Chưa có dữ liệu';
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${Math.floor(minutes)} phút trước`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} giờ trước`;
  return `${Math.floor(minutes / (60 * 24))} ngày trước`;
}

/** ok < 6 h, warn up to 24 h, bad beyond (or no data). A UI hint, not a product rule. */
export function ageTone(minutes) {
  if (minutes == null || minutes >= 60 * 24) return 'bad';
  return minutes >= 60 * 6 ? 'warn' : 'ok';
}
