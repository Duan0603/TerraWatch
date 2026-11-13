import { scoreText, numberText, rainLevel24h } from './weather.js';
import { fmtVN } from './time.js';

const GREY = '#9ca3af';

// Map paint: one sequential purple ramp (kept apart from the orange/red of reviewed forecasts) for current
// scores; grey for anything not current, so an old score is never read as today's.
export const RISK_COLOR = ['case', ['==', ['get', 'current'], true],
  ['interpolate', ['linear'], ['to-number', ['get', 'hazard_score'], 0], 0, '#ede9fe', 0.3, '#a78bfa', 0.6, '#6d28d9', 1, '#3b0764'],
  GREY];

// "Mưa 24h tới" mode: QĐ 18/2021/QĐ-TTg classes, same thresholds as rainLevel24h (> 50 mưa to, > 100 mưa rất to).
// Blue, so it is never confused with the GRU score or the reviewed forecasts. Stale weather is grey.
export const RAIN_COLOR = ['case',
  ['any', ['==', ['get', 'stale'], true], ['!', ['has', 'forecast_24h_mm']]], GREY,
  ['>', ['get', 'forecast_24h_mm'], 100], '#1d4ed8',
  ['>', ['get', 'forecast_24h_mm'], 50], '#60a5fa',
  '#dbeafe'];

/** How many points carry usable data for the chosen colouring (shown as "current/total" on the map button). */
export const usableCount = (features, mode) => (features || []).filter(f => (mode === 'rain'
  ? !f.properties.stale && f.properties.forecast_24h_mm != null
  : f.properties.current)).length;

const REASONS = {
  STATIC_FEATURES_UNAVAILABLE: 'chưa có số liệu đất/độ dốc cho ô này',
  WEATHER_STALE: 'dữ liệu mưa đã cũ',
  INCOMPLETE_WEATHER: 'chuỗi mưa chưa đủ giờ',
  MODEL_UNAVAILABLE_OR_INVALID_INPUT: 'mô hình chưa trả kết quả',
  DISABLED: 'suy luận tự động đang tắt',
};

// Which part drives the score: the live GRU rain part tends to sit at ~0 or ~1, so say so instead of letting
// a dark cell read as "a lot of rain".
function driver(p) {
  if (p.temporal_score >= 0.95) return 'Phần mưa đang ở mức tối đa, nên điểm cao hay thấp chủ yếu do đất/địa hình.';
  if (p.temporal_score <= 0.05) return `Phần mưa gần 0, nên điểm thấp dù đất/địa hình ở mức ${scoreText(p.spatial_score)}.`;
  return 'Cả phần mưa và phần đất/địa hình cùng góp vào điểm.';
}

/** Popup text for one experimental GRU point; properties come from GET /gis/rainfall/live/map. */
export function describeRisk(p) {
  const lines = [];
  if (p.current) {
    lines.push(`Điểm mô hình thử nghiệm: ${scoreText(p.hazard_score)} (mưa ${scoreText(p.temporal_score)} × đất/địa hình ${scoreText(p.spatial_score)})`);
    lines.push(driver(p));
  } else if (p.reason) {
    lines.push(`Chưa có điểm: ${REASONS[p.reason] || p.reason}.`);
  } else {
    const why = p.expired ? 'kết quả đã hết hiệu lực' : 'dữ liệu mưa cũ hoặc lần cập nhật gần nhất bị lỗi';
    lines.push(`Không dùng như hiện tại: ${why}${p.hazard_score != null ? ` (lần trước ${scoreText(p.hazard_score)})` : ''}.`);
  }
  const level = !p.stale && rainLevel24h(p.forecast_24h_mm);
  lines.push(`Mưa 24 giờ qua ${numberText(p.rain_24h_mm, ' mm', 1)} · dự báo 24 giờ tới ${numberText(p.forecast_24h_mm, ' mm', 1)}`
    + (level ? ` (${level.label})` : p.stale ? ' (số liệu cũ)' : ''));
  if (p.issue_time) lines.push(`Hiệu lực: ${fmtVN(p.issue_time)} → ${fmtVN(p.valid_until)}`);
  lines.push('Mưa Open-Meteo khác nguồn lúc huấn luyện; điểm không phải xác suất, không phải mức nguy cơ, không phải cảnh báo.');
  return { title: p.name, lines };
}
