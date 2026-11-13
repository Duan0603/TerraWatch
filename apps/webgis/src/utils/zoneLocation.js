import { calculateDistanceKm } from '../data/vietnamRiskData.js';

// Ray casting on a GeoJSON ring of [lng, lat]; the closing vertex may repeat the first.
export function pointInRing([lng, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Monitored weather points from GET /gis/rainfall/live/map. The coordinate comes from the cache key
// ("lat,lng" rounded to 4 places), because the live rainfall lookup matches that key exactly.
export function monitoredPoints(collection) {
  return (collection?.features || []).map(f => {
    const [lat, lng] = String(f.properties?.key || '').split(',').map(Number);
    return { key: f.properties.key, name: f.properties.name, lat, lng };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export function nearestPoint(points, position) {
  return points.map(p => ({ ...p, distanceKm: calculateDistanceKm(position, [p.lng, p.lat]) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
}

// Zones the user stands in first, then the rest by distance to the zone centre.
export function rankZones(zones, position) {
  return zones
    .map(z => ({ ...z, inside: Array.isArray(z.polygon) && pointInRing(position, z.polygon),
                 distanceKm: calculateDistanceKm(position, [z.lng, z.lat]) }))
    .sort((a, b) => (b.inside - a.inside) || (a.distanceKm - b.distanceKm));
}
