import { scoreText, numberText } from './weather.js';
import { fmtVN } from './time.js';

// Map paint: one sequential purple ramp (kept apart from the orange/red of reviewed forecasts) for current
// scores; grey for anything not current, so an old score is never read as today's.
export const RISK_COLOR = ['case', ['==', ['get', 'current'], true],
  ['interpolate', ['linear'], ['to-number', ['get', 'hazard_score'], 0], 0, '#ede9fe', 0.3, '#a78bfa', 0.6, '#6d28d9', 1, '#3b0764'],
  '#9ca3af'];

const REASONS = {
  STATIC_FEATURES_UNAVAILABLE: 'chưa có số liệu đất/độ dốc cho ô này',
  WEATHER_STALE: 'dữ liệu mưa đã cũ',
  INCOMPLETE_WEATHER: 'chuỗi mưa chưa đủ giờ',
  MODEL_UNAVAILABLE_OR_INVALID_INPUT: 'mô hình chưa trả kết quả',
  DISABLED: 'suy luận tự động đang tắt',
};

/** Popup text for one experimental GRU point; properties come from GET /gis/rainfall/live/map. */
export function describeRisk(p) {
  const lines = [];
  if (p.current) {
    lines.push(`Điểm GRU thử nghiệm: ${scoreText(p.hazard_score)} (mưa ${scoreText(p.temporal_score)} × đất/địa hình ${scoreText(p.spatial_score)})`);
  } else if (p.reason) {
    lines.push(`Chưa có điểm: ${REASONS[p.reason] || p.reason}.`);
  } else {
    const why = p.expired ? 'kết quả đã hết hiệu lực' : 'dữ liệu mưa cũ hoặc lần cập nhật gần nhất bị lỗi';
    lines.push(`Không dùng như hiện tại: ${why}${p.hazard_score != null ? ` (lần trước ${scoreText(p.hazard_score)})` : ''}.`);
  }
  lines.push(`Mưa 24 giờ qua ${numberText(p.rain_24h_mm, ' mm', 1)} · dự báo 24 giờ tới ${numberText(p.forecast_24h_mm, ' mm', 1)}`);
  if (p.issue_time) lines.push(`Hiệu lực: ${fmtVN(p.issue_time)} → ${fmtVN(p.valid_until)}`);
  lines.push('Mưa Open-Meteo khác nguồn lúc huấn luyện; điểm không phải xác suất, không phải cảnh báo.');
  return { title: p.name, lines };
}
