// Story 4.22: chuẩn bị trang chủ NGAY SAU KHI ĐĂNG NHẬP, ngay trên trang login (có thanh tiến độ),
// để khi vào trang chủ bản đồ và dữ liệu đã sẵn, không bị giật hay trắng bản đồ.
//  - dữ liệu: gọi trước hàng đợi dự báo / báo cáo hiện trường / vùng giám sát, trang chủ lấy lại kết quả;
//  - bản đồ: dựng một bản đồ ẩn cùng style + địa hình 3D, đợi 'idle' để trình duyệt giữ sẵn style, font,
//    sprite và các ô bản đồ đầu tiên trong cache, rồi hủy.
import forecastApi from '../api/forecastApi';
import { STYLE_URL, TERRAIN_CONFIG, DEFAULT_CAMERA } from '../config/mapConfig';

const TTL_MS = 60_000;
const store = new Map(); // key -> { promise, at }

/** Gọi trước một API, giữ promise để trang chủ dùng lại (hết hạn sau 60 giây). */
export function prefetch(key, loader) {
  const promise = loader();
  promise.catch(() => {}); // lỗi để trang chủ tự xử lý bằng lời gọi thật
  store.set(key, { promise, at: Date.now() });
  return promise;
}

/** Lấy kết quả đã gọi trước (dùng một lần); không có, quá hạn hoặc lỗi thì gọi `fallback`. */
export async function takePrefetched(key, fallback) {
  const hit = store.get(key);
  store.delete(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    try { return await hit.promise; } catch { /* rơi xuống gọi thật */ }
  }
  return fallback();
}

async function warmMap(timeoutMs) {
  if (typeof window === 'undefined' || !window.WebGLRenderingContext) return;
  const maplibregl = await import('maplibre-gl');
  const { default: workerUrl } = await import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url');
  if (typeof maplibregl.setWorkerUrl === 'function') maplibregl.setWorkerUrl(workerUrl);

  const box = document.createElement('div');
  // Ngoài màn hình nhưng có kích thước thật để MapLibre xin đúng số ô bản đồ.
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:720px;pointer-events:none;';
  document.body.appendChild(box);
  let map;
  try {
    map = new maplibregl.Map({
      container: box,
      style: STYLE_URL,
      center: DEFAULT_CAMERA.center,
      zoom: DEFAULT_CAMERA.zoom,
      pitch: DEFAULT_CAMERA.pitch,
      bearing: DEFAULT_CAMERA.bearing,
      interactive: false,
      attributionControl: false
    });
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs); // mạng chậm: không bắt người dùng đợi mãi
      map.on('style.load', () => {
        try {
          if (!map.getSource(TERRAIN_CONFIG.sourceId)) {
            map.addSource(TERRAIN_CONFIG.sourceId, TERRAIN_CONFIG.source);
            map.setTerrain({ source: TERRAIN_CONFIG.sourceId, exaggeration: TERRAIN_CONFIG.exaggeration });
          }
        } catch { /* địa hình lỗi thì bản đồ thật tự xử lý */ }
      });
      map.on('error', () => { /* lỗi từng ô không chặn việc vào trang */ });
      map.once('idle', () => { clearTimeout(timer); resolve(); });
    });
  } finally {
    try { map?.remove(); } catch { /* bỏ qua */ }
    box.remove();
  }
}

/**
 * Chạy các bước chuẩn bị song song; `onStep(key, 'run'|'done')` báo tiến độ.
 * Luôn kết thúc trong tối đa `maxMs`, và không nhanh hơn `minMs` để màn hình không nháy.
 */
export async function warmUpHome(role, onStep, { minMs = 900, maxMs = 9_000 } = {}) {
  const isCitizen = String(role || '').toLowerCase().includes('citizen');
  const track = async (key, fn) => {
    onStep(key, 'run');
    try { await fn(); } catch { /* bước phụ: lỗi thì vẫn cho vào */ }
    onStep(key, 'done');
  };
  const tasks = [track('map', () => warmMap(maxMs - 1500))];
  if (!isCitizen) {
    tasks.push(track('data', () => Promise.all([
      prefetch('queue', () => forecastApi.getReviewQueue('all')),
      prefetch('fieldReports', () => forecastApi.getFieldReports()),
      prefetch('aoi', () => forecastApi.getAoiCollection())
    ])));
  }
  await Promise.all([
    Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, maxMs))]),
    new Promise((r) => setTimeout(r, minMs))
  ]);
}
