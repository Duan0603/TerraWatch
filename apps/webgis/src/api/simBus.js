/**
 * simBus – kênh chia sẻ kết quả mô phỏng giữa AutoSimPage và DashboardPage.
 * Dùng sessionStorage (cùng tab) + BroadcastChannel (giữa các tab).
 */

const STORAGE_KEY = 'tw_sim_overlay';
const CHANNEL_NAME = 'terrawatch-sim';

// Tọa độ thực của các preset địa hình (lấy từ gis_schema.spatial_assessment_units)
const TERRAIN_COORDS = {
  batxat:     { lng: 103.855, lat: 22.525, name: 'Bát Xát, Lào Cai' },
  sapa:       { lng: 103.875, lat: 22.315, name: 'Sa Pa, Lào Cai' },
  thuongxuan: { lng: 105.17,  lat: 19.83,  name: 'Thường Xuân, Thanh Hóa' },
  thoai:      null, // địa hình tham chiếu, không hiện trên bản đồ
};

// Tạo đa giác hình thoi ~5km quanh tâm điểm
function makePolygon(lng, lat, r = 0.025) {
  return [
    [lng,     lat + r],
    [lng + r, lat    ],
    [lng,     lat - r],
    [lng - r, lat    ],
    [lng,     lat + r],
  ];
}

const RISK_MAP = { EXTREME: 'extreme', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

/** Chuyển dict kết quả tự động mô phỏng → mảng GeoEvent để hiện trên bản đồ */
export function simResultsToEvents(results) {
  if (!results) return [];
  const events = [];
  for (const [key, r] of Object.entries(results)) {
    if (!r || r.status !== 'done') continue;
    if (!r.alert_level || r.alert_level === 'SAFE') continue;
    const [, terrainKey] = key.split('/');
    const coords = TERRAIN_COORDS[terrainKey];
    if (!coords) continue;
    events.push({
      id: `sim-${key.replace('/', '-')}`,
      location: `[Mô phỏng] ${coords.name}`,
      risk: RISK_MAP[r.alert_level] || 'medium',
      status: 'sim',
      lng: coords.lng,
      lat: coords.lat,
      polygon: makePolygon(coords.lng, coords.lat),
      isSim: true,
      hazardScore: r.hazard_score,
      alertLevel: r.alert_level,
      scenarioLabel: r.scenario,
    });
  }
  return events;
}

/** Lưu kết quả vào sessionStorage và phát broadcast sang các tab khác */
export function saveSimResults(results) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(results)); } catch {}
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'sim-update', results });
    ch.close();
  } catch {}
}

/** Đọc kết quả đã lưu từ sessionStorage */
export function loadSimResults() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}

/** Xóa kết quả mô phỏng */
export function clearSimResults() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'sim-clear' });
    ch.close();
  } catch {}
}

/** Đăng ký lắng nghe cập nhật từ tab khác. Trả về hàm hủy đăng ký. */
export function subscribeSimResults(onUpdate, onClear) {
  let ch;
  try {
    ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e) => {
      if (e.data?.type === 'sim-update' && onUpdate) onUpdate(e.data.results);
      if (e.data?.type === 'sim-clear' && onClear) onClear();
    };
  } catch {}
  return () => { try { ch?.close(); } catch {} };
}
