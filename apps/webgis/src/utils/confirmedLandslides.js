// Story 4.38: helpers for the "confirmed landslides" map layer. No imports: Node tests load this file as it is.

// Same wording as RISK_LABELS in components/EventCard.jsx (that file has JSX, so Node tests cannot import it)
const RISK = { extreme: 'Cực nguy hiểm', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const VN = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });

// A coordinate tree must end in [lon, lat] pairs of finite numbers; anything else would break the map layer.
const validCoords = (c) => Array.isArray(c) && c.length > 0
  && (typeof c[0] === 'number' ? c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) : c.every(validCoords));

const validFeature = (f) => !!f && !!f.properties && ['Polygon', 'MultiPolygon'].includes(f.geometry?.type) && validCoords(f.geometry.coordinates);

/** Anything that is not a FeatureCollection with valid polygons (empty array, error body, broken geometry) counts as "no data". */
export function toConfirmedCollection(data) {
  const features = data && data.type === 'FeatureCollection' && Array.isArray(data.features)
    ? data.features.filter(validFeature)
    : [];
  return { type: 'FeatureCollection', features };
}

/** [[west, south], [east, north]] around all features, or null when there is nothing to frame. */
export function confirmedBounds(collection) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); }
    else c.forEach(walk);
  };
  (collection?.features || []).forEach(f => Array.isArray(f.geometry?.coordinates) && walk(f.geometry.coordinates));
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}

/** One Point per feature (centre of its bounding box, same properties) so small areas stay visible when zoomed out. */
export function confirmedCentres(collection) {
  const features = [];
  (collection?.features || []).forEach(f => {
    const b = confirmedBounds({ features: [f] });
    if (b) features.push({ type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2] } });
  });
  return { type: 'FeatureCollection', features };
}

/** Text lines for the map popup. The map shows them with textContent, never innerHTML. */
export function describeConfirmed(props = {}) {
  const area = Number.isFinite(props.area_m2) ? `${(props.area_m2 / 10000).toFixed(1)} ha` : '—';
  const conf = Number.isFinite(props.confidence) ? `${Math.round(props.confidence * 100)}%` : '—';
  const slope = Number.isFinite(props.slope) ? `${props.slope.toFixed(1)}°` : '—';
  return {
    title: 'SẠT LỞ ĐÃ XÁC NHẬN',
    lines: [
      `Mức độ: ${RISK[props.risk_level] || props.risk_level || '—'}`,
      `Diện tích: ${area} · Độ dốc: ${slope}`,
      `Độ tin cậy mô hình: ${conf}`,
      `Phát hiện từ ảnh vệ tinh: ${props.scene_id || '—'}`,
      `Cán bộ xác nhận lúc: ${props.verified_at ? VN.format(new Date(props.verified_at)) : '—'} (UTC+7)`
    ]
  };
}
