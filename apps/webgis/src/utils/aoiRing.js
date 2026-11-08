// Vòng ranh giới AOI: chuỗi JSON [[lng, lat], ...] (ô nhập tay) <-> danh sách điểm mở dùng để vẽ trên bản đồ.

// Trả về các điểm hợp lệ, bỏ điểm cuối nếu trùng điểm đầu (vòng đã khép); JSON lỗi -> [].
export function parseRing(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const pts = raw
    .filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(p => [p[0], p[1]]);
  const first = pts[0], last = pts[pts.length - 1];
  if (pts.length > 1 && first[0] === last[0] && first[1] === last[1]) pts.pop();
  return pts;
}

// Từ 3 điểm trở lên thì khép vòng (điểm cuối = điểm đầu) như GeoJSON Polygon yêu cầu.
export function ringToJson(pts) {
  const rounded = pts.map(p => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))]);
  return JSON.stringify(rounded.length >= 3 ? [...rounded, rounded[0]] : rounded, null, 2);
}

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// Vòng có hai cạnh không kề nhau cắt nhau (hình nơ)? PostGIS vẫn nhận nhưng ST_IsValid = false
// nên diện tích và phép giao không gian sai -> chặn ngay khi vẽ.
export function selfIntersects(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // cạnh đầu và cạnh cuối kề nhau qua điểm đóng
      const [a, b, c, d] = [pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  }
  return false;
}
