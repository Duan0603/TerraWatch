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

// Zones the user stands in first, then the rest by distance to the zone centre.
export function rankZones(zones, position) {
  return zones
    .map(z => ({ ...z, inside: Array.isArray(z.polygon) && pointInRing(position, z.polygon),
                 distanceKm: calculateDistanceKm(position, [z.lng, z.lat]) }))
    .sort((a, b) => (b.inside - a.inside) || (a.distanceKm - b.distanceKm));
}
