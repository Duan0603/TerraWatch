// =============================================================================
// Mapbox GL JS Configuration & 3D Terrain Presets
// =============================================================================

export const getMapboxToken = () => {
  const token = localStorage.getItem('terrawatch_mapbox_token') || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
  return token.trim();
};

export const MAPBOX_ACCESS_TOKEN = getMapboxToken();

// Các điểm nóng thiên tai sạt lở Tây Bắc (Yên Bái, Lào Cai)
export const CAMERA_PRESETS = {
  defaultCenter: [104.150, 22.050], // Trung tâm vùng Tây Bắc
  defaultZoom: 11.5,
  defaultPitch: 60, // Nghiêng camera 60 độ để thấy rõ sườn dốc 3D
  defaultBearing: 30, // Hướng nhìn Đông Bắc
  
  // Tọa độ chi tiết từng điểm trọng yếu
  locations: {
    'khau-pha': { center: [104.085, 21.845], zoom: 13.8, pitch: 62, bearing: 35 },
    'de-xu-phinh': { center: [104.110, 21.860], zoom: 14.2, pitch: 65, bearing: -25 },
    'bac-ha': { center: [104.280, 22.510], zoom: 13.5, pitch: 58, bearing: 40 },
    'lang-nu': { center: [104.420, 22.350], zoom: 14.0, pitch: 65, bearing: 45 },
  }
};

// Cấu hình nguồn DEM địa hình số 3D (Digital Elevation Model)
export const TERRAIN_CONFIG = {
  sourceId: 'mapbox-dem',
  sourceUrl: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  tileSize: 512,
  maxzoom: 14,
  exaggeration: 1.5 // Phóng đại độ cao sườn đồi núi 1.5 lần để trực quan hóa ta-luy
};

export default {
  MAPBOX_ACCESS_TOKEN,
  CAMERA_PRESETS,
  TERRAIN_CONFIG
};
