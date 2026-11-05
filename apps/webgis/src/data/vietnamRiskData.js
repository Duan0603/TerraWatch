/**
 * Vietnam Landslide Susceptibility Geospatial Service & Data Access Layer
 * Module cung cấp dữ liệu viễn thám và ranh giới không gian các vùng nguy cơ trượt lở đất tại Việt Nam.
 * Cung cấp các phương thức truy vấn theo tỉnh, mức độ nhạy cảm (susceptibility), ngưỡng mưa tới hạn, và trạm quan trắc.
 */

import riskZonesData from './vietnamLandslideRiskZones.json';

/**
 * Toàn bộ tập dữ liệu GeoJSON FeatureCollection của các vùng sạt lở
 */
export const VIETNAM_LANDSLIDE_GEOJSON = riskZonesData;

/**
 * Danh sách toàn bộ các vùng có nguy cơ sạt lở (103 khu vực trọng điểm)
 */
export const LANDSLIDE_RISK_ZONES = riskZonesData.features.map(f => ({
  id: f.id,
  ...f.properties,
  geometry: f.geometry
}));

/**
 * Bản đồ chỉ mục theo ID để truy xuất O(1)
 * @type {Map<string, object>}
 */
const ZONES_BY_ID = new Map(LANDSLIDE_RISK_ZONES.map(z => [z.id, z]));

/**
 * Bản đồ chỉ mục theo Tỉnh thành để truy xuất nhanh
 * @type {Map<string, object[]>}
 */
const ZONES_BY_PROVINCE = new Map();
LANDSLIDE_RISK_ZONES.forEach(zone => {
  const prov = zone.province_vi;
  if (!ZONES_BY_PROVINCE.has(prov)) {
    ZONES_BY_PROVINCE.set(prov, []);
  }
  ZONES_BY_PROVINCE.get(prov).push(zone);
});

/**
 * Lấy thông tin chi tiết vùng nguy cơ theo ID
 * @param {string} zoneId - Mã định danh vùng (vd: 'LC-SP', 'YB-MC')
 * @returns {object|undefined} Thông tin vùng hoặc undefined
 */
export function getLandslideZoneById(zoneId) {
  if (!zoneId) return undefined;
  return ZONES_BY_ID.get(zoneId);
}

/**
 * Lấy danh sách vùng nguy cơ theo Tên Tỉnh
 * @param {string} provinceName - Tên tỉnh (vd: 'Lào Cai', 'Hà Giang', 'Yên Bái')
 * @returns {object[]} Danh sách các vùng thuộc tỉnh
 */
export function getZonesByProvince(provinceName) {
  if (!provinceName) return [];
  return ZONES_BY_PROVINCE.get(provinceName) || [];
}

/**
 * Lọc danh sách vùng theo cấp độ nguy cơ (CRITICAL, HIGH, MODERATE, LOW)
 * @param {'CRITICAL'|'HIGH'|'MODERATE'|'LOW'} tier - Cấp độ nguy cơ
 * @returns {object[]}
 */
export function getZonesBySusceptibilityTier(tier) {
  if (!tier) return LANDSLIDE_RISK_ZONES;
  return LANDSLIDE_RISK_ZONES.filter(z => z.susceptibility_tier === tier);
}

/**
 * Lấy danh sách các vùng nguy cơ đặc biệt nghiêm trọng (CRITICAL)
 * @returns {object[]}
 */
export function getCriticalRiskZones() {
  return getZonesBySusceptibilityTier('CRITICAL');
}

/**
 * Tính khoảng cách đại trực tuyến (Haversine formula) giữa 2 tọa độ (km)
 * @param {[number, number]} coord1 - [lng, lat]
 * @param {[number, number]} coord2 - [lng, lat]
 * @returns {number} Khoảng cách tính bằng km
 */
export function calculateDistanceKm(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Tìm vùng sạt lở gần nhất so với vị trí hiện tại của người dùng
 * @param {[number, number]} currentCoord - [lng, lat]
 * @returns {{zone: object, distanceKm: number}|null}
 */
export function findNearestRiskZone(currentCoord) {
  if (!currentCoord || currentCoord.length < 2) return null;
  let nearest = null;
  let minDistance = Infinity;

  for (const zone of LANDSLIDE_RISK_ZONES) {
    const dist = calculateDistanceKm(currentCoord, zone.center_coordinate);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = zone;
    }
  }

  return nearest ? { zone: nearest, distanceKm: minDistance } : null;
}

/**
 * Kiểm tra xem lượng mưa hiện tại có vượt ngưỡng cảnh báo sạt lở của vùng hay không
 * @param {string} zoneId - Mã vùng
 * @param {number} rainfall24hMm - Lượng mưa đo được trong 24h (mm)
 * @returns {'SAFE'|'ADVISORY'|'WATCH'|'WARNING'} Trạng thái cảnh báo
 */
export function evaluateRainfallAlertLevel(zoneId, rainfall24hMm) {
  const zone = getLandslideZoneById(zoneId);
  if (!zone || typeof rainfall24hMm !== 'number') return 'SAFE';

  const { advisory_yellow_mm_24h, watch_orange_mm_24h, warning_red_mm_24h } =
    zone.early_warning_thresholds;

  if (rainfall24hMm >= warning_red_mm_24h) {
    return 'WARNING';
  } else if (rainfall24hMm >= watch_orange_mm_24h) {
    return 'WATCH';
  } else if (rainfall24hMm >= advisory_yellow_mm_24h) {
    return 'ADVISORY';
  }
  return 'SAFE';
}

/**
 * Lấy danh sách thống kê tổng quan toàn quốc
 * @returns {{totalZones: number, criticalCount: number, highCount: number, moderateCount: number, totalProvinces: number}}
 */
export function getNationalLandslideRiskSummary() {
  const criticalCount = LANDSLIDE_RISK_ZONES.filter(z => z.susceptibility_tier === 'CRITICAL').length;
  const highCount = LANDSLIDE_RISK_ZONES.filter(z => z.susceptibility_tier === 'HIGH').length;
  const moderateCount = LANDSLIDE_RISK_ZONES.filter(z => z.susceptibility_tier === 'MODERATE').length;
  
  return {
    totalZones: LANDSLIDE_RISK_ZONES.length,
    criticalCount,
    highCount,
    moderateCount,
    totalProvinces: ZONES_BY_PROVINCE.size
  };
}
