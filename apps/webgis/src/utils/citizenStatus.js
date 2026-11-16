// Story 4.43: "is my area safe today?" for the citizen page, from the hourly rain data GIS already serves.
import { pointInRing } from './zoneLocation.js';
import { calculateDistanceKm } from '../data/vietnamRiskData.js';
import { levelKey } from './rainWarning.js';

export const RANK = { missing: -1, none: 0, watch: 1, warning: 2, danger: 3 };
const FROM_PERCENTILE = { p95: 'watch', p99: 'warning', p99_9: 'danger' };
const NEAR_KM = 30;

export const worse = (a, b) => ((RANK[b] ?? -1) > (RANK[a] ?? -1) ? b : a);

/** Outer rings of a (Multi)Polygon geometry. */
export function outerRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p[0]);
  return [];
}

export function centroid(geometry) {
  // a closed ring repeats its first vertex at the end: count it once
  const pts = outerRings(geometry).flatMap((r) => (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r));
  if (!pts.length) return null;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Rain points that represent an area: those inside it, else the nearest one within 30 km of its centre. */
export function pointsForArea(geometry, points) {
  const rings = outerRings(geometry);
  const inside = points.filter((p) => rings.some((r) => pointInRing([p.lng, p.lat], r)));
  if (inside.length) return { points: inside, nearKm: null };
  const c = centroid(geometry);
  if (!c) return { points: [], nearKm: null };
  const near = points.map((p) => ({ p, km: calculateDistanceKm(c, [p.lng, p.lat]) })).sort((a, b) => a.km - b.km)[0];
  return near && near.km <= NEAR_KM ? { points: [near.p], nearKm: Math.round(near.km) } : { points: [], nearKm: null };
}

/**
 * One rain point's status from its live payload (GET /gis/rainfall/live → data).
 * Làng Nủ carries the calibrated rain-threshold warning (Story 4.41); every other point compares its 72 h rain and the
 * 24 h forecast with its own 28-year percentiles (IMERG): P95 → Theo dõi, P99 → Cảnh báo, P99.9 → Nguy hiểm.
 */
export function pointStatus(data) {
  const w = data?.rain_warning;
  const an = data?.rain_anomaly;
  if (w?.now) {
    return {
      now: levelKey(w.now), next: w.next_24h ? levelKey(w.next_24h) : 'missing',
      rain72: w.now.totals_mm?.['72'] ?? null, forecast24: an?.forecast_24h?.mm ?? null,
      usual72: an?.history_72h?.p95 ?? null, calibrated: true
    };
  }
  if (an?.history_72h) {
    const lv = (x) => (x?.mm == null ? 'missing' : FROM_PERCENTILE[x.level] || 'none');
    return {
      now: lv(an.history_72h), next: lv(an.forecast_24h),
      rain72: an.history_72h.mm, forecast24: an.forecast_24h?.mm ?? null, usual72: an.history_72h.p95, calibrated: false
    };
  }
  return { now: 'missing', next: 'missing', rain72: null, forecast24: null, usual72: null, calibrated: false };
}

/** Area status = its worst point (the one people should act on). */
export function areaStatus(statuses) {
  const ok = statuses.filter(Boolean);
  if (!ok.length) return { now: 'missing', next: 'missing', worst: 'missing', point: null };
  const score = (s) => Math.max(RANK[s.now] ?? -1, RANK[s.next] ?? -1);
  const point = ok.reduce((a, b) => (score(b) > score(a) ? b : a));
  return { now: point.now, next: point.next, worst: worse(point.now, point.next), point };
}

/** Plain-language advice for a level (what a villager should do now). */
export const ADVICE = {
  none: 'Mưa ở mức bình thường của nơi này. Không cần làm gì, vẫn để ý tin thời tiết.',
  watch: 'Mưa nhiều hơn thường lệ. Để ý vết nứt đất, nước suối đục, đá lăn; chuẩn bị sẵn giấy tờ, đèn pin, thuốc.',
  warning: 'Mưa rất lớn so với 28 năm qua. Chuẩn bị sơ tán; tránh khe suối, chân dốc và taluy, nhất là ban đêm.',
  danger: 'Mưa ở mức cực đoan. Sơ tán ngay theo hướng dẫn của chính quyền; rời nhà gần khe suối và chân dốc.',
  missing: 'Chưa có số liệu mưa cho khu vực này. Theo dõi thông báo của chính quyền địa phương.'
};

/** Areas a citizen follows, with the ids taken from their subscriptions; position suggests the nearest otherwise. */
export function nearestArea(features, position) {
  if (!position || !features?.length) return null;
  return features.map((f) => ({ f, km: calculateDistanceKm(position, centroid(f.geometry) || position) }))
    .sort((a, b) => a.km - b.km)[0]?.f || null;
}

/** Where the citizen stands: the area containing the position, else the nearest one (by centre) with its distance. */
export function locateArea(features, position) {
  if (!position || !features?.length) return null;
  const inside = features.find((f) => outerRings(f.geometry).some((r) => pointInRing(position, r)));
  if (inside) return { feature: inside, inside: true, km: 0 };
  const f = nearestArea(features, position);
  return f && { feature: f, inside: false, km: Math.round(calculateDistanceKm(position, centroid(f.geometry))) };
}

/** The rain point that speaks for a position: the nearest one within 30 km, or null. */
export function pointNear(points, position) {
  if (!position) return null;
  const n = points.map((p) => ({ ...p, km: calculateDistanceKm(position, [p.lng, p.lat]) })).sort((a, b) => a.km - b.km)[0];
  return n && n.km <= NEAR_KM ? { ...n, km: Math.round(n.km) } : null;
}
