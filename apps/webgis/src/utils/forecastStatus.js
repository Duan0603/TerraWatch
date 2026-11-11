// Reason codes come from the AI contract (services/ai-service/app/main.py) and from ForecastJobService.
const REASONS = {
  SNAPSHOT_MISSING: 'Chưa có bộ đặc trưng đầu vào (snapshot) cho lần chạy này',
  MODEL_NOT_RELEASED: 'Mô hình dự báo 24 giờ chính thức chưa phát hành',
};

// Officers read Vietnamese; unknown codes stay as-is so nothing is hidden.
export function reasonText(reason) {
  if (!reason) return 'thiếu dữ liệu đầu vào';
  if (/circuit breaker|AI service unavailable/i.test(reason)) return 'Không kết nối được dịch vụ AI khi chạy dự báo';
  return reason.split(/,\s*/).map(code => REASONS[code] || code).join('; ');
}

// A stale run is the most important thing to say, so "expired" outranks "unavailable".
export const forecastState = (e) =>
  e.status === 'superseded' ? 'superseded'
  : e.expired ? 'expired'
  : e.availability !== 'available' ? 'unavailable'
  : 'fresh';
