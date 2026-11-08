// Số liệu tổng quan cho dải KPI của dashboard. Hàm thuần để kiểm thử bằng Node.

const SOON_MS = 6 * 3600 * 1000; // "sắp hết hạn" = trong 6 giờ tới
const DAY_MS = 24 * 3600 * 1000;

// events: hàng đợi dự báo (toForecastView); fieldReports: báo cáo hiện trường;
// broadcasts: lịch sử phát lệnh (toHistoryEntry) hoặc null nếu tài khoản không xem được (không phải admin).
export function buildKpis({ events, fieldReports, broadcasts, now = Date.now() }) {
  const live = events.filter(e => !e.expired && e.availability === 'available');
  const pending = events.filter(e => e.status === 'pending' && !e.expired).length;
  const extreme = live.filter(e => e.risk === 'extreme').length;
  const high = live.filter(e => e.risk === 'high').length;
  const expiringSoon = live.filter(e => {
    const left = new Date(e.validUntil).getTime() - now;
    return e.status !== 'rejected' && left > 0 && left <= SOON_MS;
  }).length;
  const newReports = fieldReports.filter(r => r.status === 'submitted').length;

  const kpis = [
    { key: 'units', label: 'Ô đánh giá', value: events.length, sub: `${live.length} còn hiệu lực`, tone: 'neutral' },
    { key: 'pending', label: 'Chờ thẩm định', value: pending, sub: pending ? 'cần cán bộ xử lý' : 'đã xử lý hết', tone: pending ? 'warn' : 'ok' },
    { key: 'risk', label: 'Nguy cơ cao', value: extreme + high, sub: `${extreme} cực nguy hiểm · ${high} cao`, tone: extreme ? 'danger' : high ? 'warn' : 'ok' },
    { key: 'expiring', label: 'Sắp hết hạn', value: expiringSoon, sub: 'trong 6 giờ tới', tone: expiringSoon ? 'warn' : 'ok' },
    { key: 'reports', label: 'Báo cáo hiện trường mới', value: newReports, sub: 'chưa xử lý', tone: newReports ? 'warn' : 'ok' },
  ];

  if (broadcasts) {
    const recent = broadcasts.filter(b => b.status !== 'ĐÃ THU HỒI' && now - new Date(b.sentAt).getTime() <= DAY_MS);
    const devices = recent.reduce((sum, b) => sum + (b.deliveredCount || 0), 0);
    kpis.push({ key: 'broadcasts', label: 'Cảnh báo đã phát 24h', value: recent.length, sub: `${devices} thiết bị đã nhận`, tone: 'neutral' });
  }
  return kpis;
}
