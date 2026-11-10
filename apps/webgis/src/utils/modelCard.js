// Story 4.29: turn the AI service's model cards into rows for the model-card dialog.
// Every number comes from the card; a missing value shows as "chưa có", nothing is estimated.

export const MODE_LABELS = { sensitive: 'Nhạy', balanced: 'Cân bằng', conservative: 'Thận trọng' };

const MISSING = 'chưa có';
const has = (v) => v !== null && v !== undefined;

/** 0.5591 -> "55,9%". */
export function fmtPct(v) {
  return has(v) && Number.isFinite(v) ? `${(v * 100).toFixed(1).replace('.', ',')}%` : MISSING;
}

/** 0.104 -> "0,104" (decimal comma, Vietnamese). */
export function fmtNum(v, digits = 2) {
  return has(v) && Number.isFinite(v) ? v.toFixed(digits).replace('.', ',') : MISSING;
}

/** First 8 characters of a hash, enough to compare by eye. */
export function shortHash(h) {
  return typeof h === 'string' && h.length >= 8 ? h.slice(0, 8) : MISSING;
}

const row = (label, value) => ({ label, value: has(value) && value !== '' ? String(value) : MISSING });

function segmentationView(c) {
  if (!c || c.ready !== true) return null;
  const modes = Object.entries(c.modes || {}).map(([key, threshold]) => ({
    key, label: MODE_LABELS[key] || key, threshold: fmtNum(threshold, 3), isDefault: key === c.default_mode
  }));
  const m = c.metrics || {};
  const official = m.L4S_official_test_800;
  const cache = m.L4S_cache_test_571_random_split_optimistic;
  const point = m.VN013_floor2?.operating_points?.[c.default_mode];
  const metrics = [];
  if (official) metrics.push(row('L4S, bộ kiểm tra chính thức (800 ảnh): F1 / IoU', `${fmtPct(official.F1)} / ${fmtPct(official.IoU)}`));
  if (cache) metrics.push(row('L4S, bộ kiểm tra tự chia (571 ảnh, lạc quan): F1 / IoU', `${fmtPct(cache.F1)} / ${fmtPct(cache.IoU)}`));
  const vn013 = point ? [
    row('Ngưỡng', fmtNum(point.threshold, 3)),
    row('Mảng sạt thật phát hiện được', point.scar_patches_hit),
    row('Vùng ứng viên', point.regions),
    row('… trong đó trùng vết sạt / báo nhầm / chưa xác minh', `${point.regions_hit} / ${point.regions_false} / ${point.regions_unverified}`),
    row('Vùng báo nhầm trên mỗi km²', fmtNum(point.false_regions_per_km2, 3)),
    row('Độ chính xác theo vùng (phần đã biết)', fmtPct(point.region_precision_known)),
    row('Theo điểm ảnh (trong cửa sổ): độ chính xác / độ phủ', `${fmtPct(point.pixel_window?.precision)} / ${fmtPct(point.pixel_window?.recall)}`)
  ] : [];
  const modeLabel = MODE_LABELS[c.default_mode] || c.default_mode;
  return {
    identity: [
      row('Tên', c.name), row('Phiên bản', c.version), row('Trạng thái theo thẻ', c.status),
      row('Dữ liệu huấn luyện', c.trained_on), row('Kênh đầu vào', (c.input_channels || []).join(', ')),
      row('Kiểm tra tệp mô hình (SHA-256)', c.sha256_ok === true ? 'Khớp với thẻ' : c.sha256_ok === false ? 'KHÔNG khớp' : MISSING),
      row('Quy tắc kiểm tra thay đổi NDVI', c.temporal_rule)
    ],
    modes, defaultModeLabel: modeLabel,
    metrics, vn013, vn013Label: vn013.length ? `Cảnh VN013, chế độ ${modeLabel}` : null,
    notes: [c.note, c.metrics_note].filter(Boolean)
  };
}

function gruView(c) {
  if (!c || c.ready !== true) return null;
  return {
    experimental: c.experimental_only === true,
    calibrated: c.calibrated_probability === true,
    rows: [
      row('Mã mô hình', c.model_id), row('Chạy bằng', c.runtime),
      row('Dữ liệu mưa quá khứ khi huấn luyện', c.trained_history_provider),
      row('Dữ liệu dự báo mưa khi huấn luyện', c.trained_forecast_provider),
      row('Mã băm điểm kiểm (SHA-256)', shortHash(c.checkpoint_sha256))
    ]
  };
}

/** {segmentation, gru} from GET /model-card -> what the dialog draws. A card that is not ready becomes null. */
export function buildModelCardView(data) {
  const segmentation = segmentationView(data?.segmentation);
  const gru = gruView(data?.gru);
  return { segmentation, gru, available: Boolean(segmentation || gru) };
}
